package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	speakingDuration = 60 * time.Second
	sideWaitDuration = 10 * time.Second
	cooldownDuration = 30 * time.Second
)

type DebateSide string
type RoomStatus string
type TopicCategory string

const (
	SideUnassigned DebateSide = "unassigned"
	SidePro        DebateSide = "pro"
	SideCon        DebateSide = "con"

	StatusWaiting RoomStatus = "waiting"
	StatusActive  RoomStatus = "active"
)

type DebateTopic struct {
	Title string `json:"title"`
	Pro   string `json:"pro"`
	Con   string `json:"con"`
}

type Persona struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Voice string `json:"voice"`
}

type Participant struct {
	ID       string     `json:"id"`
	IsHost   bool       `json:"isHost"`
	Side     DebateSide `json:"side"`
	Persona  Persona    `json:"persona"`
	JoinedAt int64      `json:"joinedAt"`
}

type RoomState struct {
	RoomID           string           `json:"roomId"`
	Category         TopicCategory    `json:"category"`
	MaxParticipants  int              `json:"maxParticipants"`
	Status           RoomStatus       `json:"status"`
	CurrentSide      DebateSide       `json:"currentSide"`
	CurrentSpeakerID *string          `json:"currentSpeakerId"`
	SpeakingEndsAt   *int64           `json:"speakingEndsAt"`
	SideWaitingSince *int64           `json:"sideWaitingSince"`
	Topic            DebateTopic      `json:"topic"`
	Participants     []Participant    `json:"participants"`
	ProQueue         []string         `json:"proQueue"`
	ConQueue         []string         `json:"conQueue"`
	Cooldowns        map[string]int64 `json:"cooldowns"`
}

type ClientMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type ServerMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type CreateRoomRequest struct {
	Category        TopicCategory `json:"category"`
	MaxParticipants int           `json:"maxParticipants"`
}

type JoinRoomResponse struct {
	Room   *RoomState `json:"room"`
	UserID string     `json:"userId"`
}

type RoomHub struct {
	mu      sync.Mutex
	rooms   map[string]*RoomState
	clients map[string]map[*websocket.Conn]ClientInfo
}

type ClientInfo struct {
	UserID string
}

type ServerConfig struct {
	Port            string
	AllowedOrigins  map[string]bool
	AllowAllOrigins bool
}

var hub = &RoomHub{
	rooms:   map[string]*RoomState{},
	clients: map[string]map[*websocket.Conn]ClientInfo{},
}

var serverConfig = loadConfig()
var upgrader = websocket.Upgrader{CheckOrigin: isAllowedOrigin}

var personas = []Persona{
	{ID: "bear", Name: "熊", Icon: "熊", Voice: "低沉厚重"},
	{ID: "dog", Name: "狗", Icon: "狗", Voice: "活泼偏高"},
	{ID: "cat", Name: "猫", Icon: "猫", Voice: "轻柔尖细"},
	{ID: "bird", Name: "鸟", Icon: "鸟", Voice: "清亮快速"},
	{ID: "robot", Name: "机器人", Icon: "机", Voice: "电子质感"},
	{ID: "alien", Name: "外星人", Icon: "外", Voice: "空间变调"},
}

var topics = map[TopicCategory][]DebateTopic{
	"technology": {
		{Title: "AI 会让普通人的工作机会变多还是变少？", Pro: "正方：机会变多", Con: "反方：机会变少"},
		{Title: "自动驾驶普及后，城市是否应该减少私人汽车？", Pro: "正方：应该减少", Con: "反方：不应减少"},
	},
	"society": {
		{Title: "匿名社交让人更真诚还是更失控？", Pro: "正方：更真诚", Con: "反方：更失控"},
		{Title: "公共场所是否应该全面限制外放声音？", Pro: "正方：应该限制", Con: "反方：不应全面限制"},
	},
	"workplace": {
		{Title: "远程办公会提升效率还是削弱协作？", Pro: "正方：提升效率", Con: "反方：削弱协作"},
		{Title: "职场新人应该优先追求成长还是稳定？", Pro: "正方：优先成长", Con: "反方：优先稳定"},
	},
	"campus": {
		{Title: "大学课程应该更重视通识教育还是职业技能？", Pro: "正方：通识教育", Con: "反方：职业技能"},
		{Title: "考试成绩是否仍然是最公平的评价方式？", Pro: "正方：仍然公平", Con: "反方：不再公平"},
	},
	"relationship": {
		{Title: "恋爱中坦白一切是否真的必要？", Pro: "正方：必要", Con: "反方：不必要"},
		{Title: "朋友之间借钱是否会破坏关系？", Pro: "正方：会破坏", Con: "反方：不一定"},
	},
	"entertainment": {
		{Title: "短视频让人更放松还是更焦虑？", Pro: "正方：更放松", Con: "反方：更焦虑"},
		{Title: "爆款影视剧是否应该更重视观众评分？", Pro: "正方：应该重视", Con: "反方：不应过度重视"},
	},
}

func main() {
	rand.Seed(time.Now().UnixNano())

	mux := http.NewServeMux()
	mux.HandleFunc("/health", withCORS(handleHealth))
	mux.HandleFunc("/api/rooms", withCORS(handleRooms))
	mux.HandleFunc("/api/rooms/", withCORS(handleRoomAction))
	mux.HandleFunc("/ws", handleWebSocket)

	go hub.tick()

	address := ":" + serverConfig.Port
	log.Println("debate-room-server listening on " + address)
	if err := http.ListenAndServe(address, mux); err != nil {
		log.Fatal(err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleRooms(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	if req.Category == "" {
		req.Category = "technology"
	}
	if req.MaxParticipants < 2 || req.MaxParticipants > 6 {
		req.MaxParticipants = 4
	}

	room, userID := hub.createRoom(req)
	writeJSON(w, http.StatusCreated, JoinRoomResponse{Room: room, UserID: userID})
}

func handleRoomAction(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/rooms/"), "/")
	if len(parts) < 2 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	roomID := parts[0]
	action := parts[1]

	switch {
	case r.Method == http.MethodPost && action == "join":
		room, userID, err := hub.joinRoom(roomID, false)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		hub.broadcast(roomID)
		writeJSON(w, http.StatusOK, JoinRoomResponse{Room: room, UserID: userID})
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("roomId")
	userID := r.URL.Query().Get("userId")
	if roomID == "" || userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "roomId and userId required"})
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("websocket upgrade:", err)
		return
	}
	defer conn.Close()

	hub.addClient(roomID, userID, conn)
	defer func() {
		if hub.removeClient(roomID, conn) {
			hub.broadcast(roomID)
		}
	}()

	hub.sendState(roomID, conn)

	for {
		var msg ClientMessage
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}
		hub.handleClientMessage(roomID, userID, msg)
	}
}

func (h *RoomHub) createRoom(req CreateRoomRequest) (*RoomState, string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	roomID := "ROOM-" + randomCode(4)
	room := &RoomState{
		RoomID:          roomID,
		Category:        req.Category,
		MaxParticipants: req.MaxParticipants,
		Status:          StatusWaiting,
		CurrentSide:     SidePro,
		Topic:           pickTopic(req.Category),
		Participants:    []Participant{},
		ProQueue:        []string{},
		ConQueue:        []string{},
		Cooldowns:       map[string]int64{},
	}

	userID := "user-" + randomCode(8)
	room.Participants = append(room.Participants, h.createParticipant(room, userID, true))
	h.rooms[roomID] = room
	return cloneRoom(room), userID
}

func (h *RoomHub) joinRoom(roomID string, isHost bool) (*RoomState, string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, ok := h.rooms[roomID]
	if !ok {
		return nil, "", errString("room not found")
	}
	if len(room.Participants) >= room.MaxParticipants {
		return nil, "", errString("room is full")
	}
	if room.Status != StatusWaiting {
		return nil, "", errString("room already started")
	}

	userID := "user-" + randomCode(8)
	room.Participants = append(room.Participants, h.createParticipant(room, userID, isHost))
	return cloneRoom(room), userID, nil
}

func (h *RoomHub) addClient(roomID, userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[roomID] == nil {
		h.clients[roomID] = map[*websocket.Conn]ClientInfo{}
	}
	h.clients[roomID][conn] = ClientInfo{UserID: userID}
}

func (h *RoomHub) removeClient(roomID string, conn *websocket.Conn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.clients[roomID]
	if clients == nil {
		return false
	}

	info, ok := clients[conn]
	if !ok {
		return false
	}

	delete(clients, conn)

	if h.userHasOtherConnectionsLocked(roomID, info.UserID) {
		return false
	}

	room := h.rooms[roomID]
	if room == nil {
		return false
	}

	wasCurrentSpeaker := room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == info.UserID
	changed := removeParticipant(room, info.UserID)
	if !changed {
		return false
	}

	if len(room.Participants) == 0 {
		delete(h.rooms, roomID)
		delete(h.clients, roomID)
		return false
	}

	ensureHost(room)
	if wasCurrentSpeaker {
		room.CurrentSide = oppositeSide(room.CurrentSide)
		tryStartNextSpeaker(room, time.Now())
	}
	return true
}

func (h *RoomHub) userHasOtherConnectionsLocked(roomID, userID string) bool {
	for _, info := range h.clients[roomID] {
		if info.UserID == userID {
			return true
		}
	}
	return false
}

func (h *RoomHub) handleClientMessage(roomID, userID string, msg ClientMessage) {
	h.mu.Lock()
	room := h.rooms[roomID]
	if room == nil {
		h.mu.Unlock()
		return
	}

	switch msg.Type {
	case "start_room":
		startRoom(room, userID)
	case "request_speak":
		requestSpeak(room, userID, time.Now())
	case "request_side":
		var data struct {
			Side DebateSide `json:"side"`
		}
		if json.Unmarshal(msg.Data, &data) == nil {
			requestSideSpeak(room, data.Side)
		}
	case "end_speak":
		if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
			endSpeaking(room, time.Now())
		}
	}
	h.mu.Unlock()

	h.broadcast(roomID)
}

func (h *RoomHub) tick() {
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for now := range ticker.C {
		changedRooms := []string{}
		h.mu.Lock()
		for roomID, room := range h.rooms {
			if tickRoom(room, now) {
				changedRooms = append(changedRooms, roomID)
			}
		}
		h.mu.Unlock()

		for _, roomID := range changedRooms {
			h.broadcast(roomID)
		}
	}
}

func (h *RoomHub) broadcast(roomID string) {
	h.mu.Lock()
	room := h.rooms[roomID]
	clients := make([]*websocket.Conn, 0, len(h.clients[roomID]))
	for conn := range h.clients[roomID] {
		clients = append(clients, conn)
	}
	snapshot := cloneRoom(room)
	h.mu.Unlock()

	msg := ServerMessage{Type: "room_state", Data: snapshot}
	for _, conn := range clients {
		if err := conn.WriteJSON(msg); err != nil {
			_ = h.removeClient(roomID, conn)
		}
	}
}

func (h *RoomHub) sendState(roomID string, conn *websocket.Conn) {
	h.mu.Lock()
	room := cloneRoom(h.rooms[roomID])
	h.mu.Unlock()
	_ = conn.WriteJSON(ServerMessage{Type: "room_state", Data: room})
}

func (h *RoomHub) createParticipant(room *RoomState, userID string, isHost bool) Participant {
	return Participant{
		ID:       userID,
		IsHost:   isHost,
		Side:     SideUnassigned,
		Persona:  pickPersona(room),
		JoinedAt: time.Now().UnixMilli(),
	}
}

func startRoom(room *RoomState, userID string) {
	participant := findParticipant(room, userID)
	if participant == nil || !participant.IsHost {
		return
	}
	if room.Status == StatusActive || len(room.Participants) != room.MaxParticipants {
		return
	}
	assignSides(room)
	room.ProQueue = []string{}
	room.ConQueue = []string{}
	room.Status = StatusActive
	room.CurrentSide = SidePro
	tryStartNextSpeaker(room, time.Now())
}

func requestSpeak(room *RoomState, userID string, now time.Time) {
	participant := findParticipant(room, userID)
	if participant == nil || room.Status != StatusActive {
		return
	}
	if participant.Side != SidePro && participant.Side != SideCon {
		return
	}
	if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
		return
	}
	if room.Cooldowns[userID] > now.UnixMilli() {
		return
	}

	queue := queueForSide(room, participant.Side)
	if contains(*queue, userID) {
		return
	}

	*queue = append(*queue, userID)
	room.Cooldowns[userID] = now.Add(cooldownDuration).UnixMilli()

	if room.CurrentSpeakerID == nil && room.CurrentSide == participant.Side {
		tryStartNextSpeaker(room, now)
	}
}

func requestSideSpeak(room *RoomState, side DebateSide) {
	queue := queueForSide(room, side)
	for _, participant := range room.Participants {
		if participant.Side == side && (room.CurrentSpeakerID == nil || *room.CurrentSpeakerID != participant.ID) && !contains(*queue, participant.ID) {
			*queue = append(*queue, participant.ID)
			break
		}
	}

	if room.Status == StatusActive && room.CurrentSpeakerID == nil && room.CurrentSide == side {
		tryStartNextSpeaker(room, time.Now())
	}
}

func endSpeaking(room *RoomState, now time.Time) {
	if room.CurrentSpeakerID == nil {
		return
	}
	room.CurrentSpeakerID = nil
	room.SpeakingEndsAt = nil
	room.SideWaitingSince = nil
	room.CurrentSide = oppositeSide(room.CurrentSide)
	tryStartNextSpeaker(room, now)
}

func tickRoom(room *RoomState, now time.Time) bool {
	if room.CurrentSpeakerID != nil && room.SpeakingEndsAt != nil && now.UnixMilli() >= *room.SpeakingEndsAt {
		endSpeaking(room, now)
		return true
	}

	if room.Status != StatusActive || room.CurrentSpeakerID != nil {
		return false
	}

	queue := queueForSide(room, room.CurrentSide)
	if len(*queue) > 0 {
		tryStartNextSpeaker(room, now)
		return true
	}

	if room.SideWaitingSince != nil && now.UnixMilli()-*room.SideWaitingSince >= sideWaitDuration.Milliseconds() {
		room.CurrentSide = oppositeSide(room.CurrentSide)
		room.SideWaitingSince = nil
		tryStartNextSpeaker(room, now)
		return true
	}

	return false
}

func tryStartNextSpeaker(room *RoomState, now time.Time) {
	if room.Status != StatusActive || room.CurrentSpeakerID != nil {
		return
	}

	queue := queueForSide(room, room.CurrentSide)
	if len(*queue) == 0 {
		if room.SideWaitingSince == nil {
			waitingSince := now.UnixMilli()
			room.SideWaitingSince = &waitingSince
		}
		return
	}

	nextID := (*queue)[0]
	*queue = (*queue)[1:]
	room.SideWaitingSince = nil
	room.CurrentSpeakerID = &nextID
	endsAt := now.Add(speakingDuration).UnixMilli()
	room.SpeakingEndsAt = &endsAt
}

func assignSides(room *RoomState) {
	targetPro := (len(room.Participants) + 1) / 2
	order := rand.Perm(len(room.Participants))
	for index, participantIndex := range order {
		if index < targetPro {
			room.Participants[participantIndex].Side = SidePro
		} else {
			room.Participants[participantIndex].Side = SideCon
		}
	}
}

func removeParticipant(room *RoomState, userID string) bool {
	removed := false
	nextParticipants := room.Participants[:0]
	for _, participant := range room.Participants {
		if participant.ID == userID {
			removed = true
			continue
		}
		nextParticipants = append(nextParticipants, participant)
	}
	room.Participants = nextParticipants

	room.ProQueue = removeFromQueue(room.ProQueue, userID)
	room.ConQueue = removeFromQueue(room.ConQueue, userID)
	delete(room.Cooldowns, userID)

	if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
		room.CurrentSpeakerID = nil
		room.SpeakingEndsAt = nil
		room.SideWaitingSince = nil
	}

	return removed
}

func removeFromQueue(queue []string, userID string) []string {
	next := queue[:0]
	for _, queuedUserID := range queue {
		if queuedUserID != userID {
			next = append(next, queuedUserID)
		}
	}
	return next
}

func ensureHost(room *RoomState) {
	hasHost := false
	for _, participant := range room.Participants {
		if participant.IsHost {
			hasHost = true
			break
		}
	}
	if hasHost || len(room.Participants) == 0 {
		return
	}
	room.Participants[0].IsHost = true
}

func pickPersona(room *RoomState) Persona {
	used := map[string]bool{}
	for _, participant := range room.Participants {
		used[participant.Persona.ID] = true
	}
	for _, persona := range personas {
		if !used[persona.ID] {
			return persona
		}
	}
	return personas[0]
}

func pickTopic(category TopicCategory) DebateTopic {
	pool := topics[category]
	if len(pool) == 0 {
		pool = topics["technology"]
	}
	return pool[rand.Intn(len(pool))]
}

func queueForSide(room *RoomState, side DebateSide) *[]string {
	if side == SidePro {
		return &room.ProQueue
	}
	return &room.ConQueue
}

func oppositeSide(side DebateSide) DebateSide {
	if side == SidePro {
		return SideCon
	}
	return SidePro
}

func findParticipant(room *RoomState, userID string) *Participant {
	for i := range room.Participants {
		if room.Participants[i].ID == userID {
			return &room.Participants[i]
		}
	}
	return nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func cloneRoom(room *RoomState) *RoomState {
	if room == nil {
		return nil
	}
	clone := *room
	clone.Participants = append([]Participant{}, room.Participants...)
	clone.ProQueue = append([]string{}, room.ProQueue...)
	clone.ConQueue = append([]string{}, room.ConQueue...)
	clone.Cooldowns = map[string]int64{}
	for key, value := range room.Cooldowns {
		clone.Cooldowns[key] = value
	}
	return &clone
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if serverConfig.AllowAllOrigins {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" && serverConfig.AllowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func loadConfig() ServerConfig {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	originsValue := os.Getenv("ALLOWED_ORIGINS")
	if originsValue == "" {
		originsValue = strings.Join([]string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:5174",
			"http://127.0.0.1:5174",
			"http://localhost:5175",
			"http://127.0.0.1:5175",
		}, ",")
	}

	allowedOrigins := map[string]bool{}
	allowAllOrigins := false
	for _, origin := range strings.Split(originsValue, ",") {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		if origin == "*" {
			allowAllOrigins = true
			continue
		}
		allowedOrigins[origin] = true
	}

	return ServerConfig{
		Port:            port,
		AllowedOrigins:  allowedOrigins,
		AllowAllOrigins: allowAllOrigins,
	}
}

func isAllowedOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if serverConfig.AllowAllOrigins {
		return true
	}
	return serverConfig.AllowedOrigins[origin]
}

func randomCode(length int) string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var builder strings.Builder
	for i := 0; i < length; i++ {
		builder.WriteByte(alphabet[rand.Intn(len(alphabet))])
	}
	return builder.String()
}

type errString string

func (e errString) Error() string {
	return string(e)
}
