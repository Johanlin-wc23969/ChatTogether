import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebateSide, RoomState, TopicCategory } from "../domain/types";
import { config } from "./config";

interface CreateRoomResponse {
  room: RemoteRoomState;
  userId: string;
}

interface RemoteRoomState extends Omit<RoomState, "cooldownUntil"> {
  cooldowns?: Record<string, number>;
  cooldownUntil?: number;
}

interface ServerMessage {
  type: string;
  data: RemoteRoomState;
}

const pendingJoinRequests = new Map<string, Promise<CreateRoomResponse | null>>();

export function useRemoteRoom() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState<TopicCategory>("technology");
  const [draftMaxParticipants, setDraftMaxParticipants] = useState(4);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(handle);
  }, []);

  const connectSocket = useCallback((roomId: string, nextUserId: string) => {
    socketRef.current?.close();
    const socket = new WebSocket(
      `${config.wsBaseUrl}/ws?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(nextUserId)}`,
    );

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "room_state") {
        setRoom(normalizeRoom(message.data, nextUserId));
      }
    };

    socketRef.current = socket;
  }, []);

  const createNewRoom = useCallback(async () => {
    socketRef.current?.close();
    socketRef.current = null;
    setRoom(null);
    setUserId(null);
    const response = await fetch(`${config.apiBaseUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: draftCategory,
        maxParticipants: draftMaxParticipants,
      }),
    });
    const payload = (await response.json()) as CreateRoomResponse;
    setUserId(payload.userId);
    setRoom(normalizeRoom(payload.room, payload.userId));
    window.history.replaceState({}, "", `${window.location.pathname}?room=${payload.room.roomId}`);
    connectSocket(payload.room.roomId, payload.userId);
  }, [connectSocket, draftCategory, draftMaxParticipants]);

  const joinRoom = useCallback(async (roomId: string) => {
    const payload = await requestJoinRoom(roomId);
    if (!payload) {
      setRoom(null);
      setUserId(null);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    setUserId(payload.userId);
    setRoom(normalizeRoom(payload.room, payload.userId));
    connectSocket(payload.room.roomId, payload.userId);
  }, [connectSocket]);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get("room");
    if (!roomId || room || userId) return;

    void joinRoom(roomId);
  }, [joinRoom, room, userId]);

  const send = useCallback((type: string, data?: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type, data }));
  }, []);

  return useMemo(
    () => ({
      room,
      now,
      draftCategory,
      draftMaxParticipants,
      userId,
      setCategory: setDraftCategory,
      setMaxParticipants: setDraftMaxParticipants,
      createNewRoom,
      closeRoom: () => {
        socketRef.current?.close();
        socketRef.current = null;
        setRoom(null);
        setUserId(null);
        window.history.replaceState({}, "", window.location.pathname);
      },
      start: () => send("start_room"),
      requestLocalSpeak: () => send("request_speak"),
      requestSide: (side: DebateSide) => send("request_side", { side }),
      endLocalSpeaking: () => send("end_speak"),
    }),
    [createNewRoom, draftCategory, draftMaxParticipants, now, room, send, userId],
  );
}

function normalizeRoom(room: RemoteRoomState, userId: string): RoomState {
  return {
    ...room,
    cooldownUntil: room.cooldowns?.[userId] ?? room.cooldownUntil ?? 0,
  };
}

function requestJoinRoom(roomId: string) {
  const pending = pendingJoinRequests.get(roomId);
  if (pending) {
    return pending;
  }

  const request = fetch(`${config.apiBaseUrl}/api/rooms/${roomId}/join`, { method: "POST" })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as CreateRoomResponse;
    })
    .catch(() => null)
    .finally(() => {
      pendingJoinRequests.delete(roomId);
    });

  pendingJoinRequests.set(roomId, request);
  return request;
}
