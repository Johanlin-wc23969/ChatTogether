import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebateSide, Persona, RoomState, TopicCategory } from "../domain/types";
import { config } from "./config";

interface CreateRoomResponse {
  room: RemoteRoomState;
  userId: string;
}

export interface LobbyRoom {
  roomId: string;
  category: TopicCategory;
  status: "waiting" | "active";
  topicTitle: string;
  personas: Persona[];
  participantCount: number;
  onlineCount: number;
  maxParticipants: number;
  canJoin: boolean;
  createdAt: number;
}

interface RemoteRoomState extends Omit<RoomState, "cooldownUntil"> {
  cooldowns?: Record<string, number>;
  cooldownUntil?: number;
}

interface ServerMessage {
  type: string;
  data: RemoteRoomState | VoiceSignal | null;
}

export interface VoiceSignal {
  from: string;
  signalType: "offer" | "answer" | "ice" | "stop";
  payload?: unknown;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

const pendingJoinRequests = new Map<string, Promise<CreateRoomResponse | null>>();
const roomSessionStorageKey = "anonymous-debate-room-session";

export function useRemoteRoom() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState<TopicCategory>("technology");
  const [draftMaxParticipants, setDraftMaxParticipants] = useState(4);
  const [lobbyRooms, setLobbyRooms] = useState<LobbyRoom[]>([]);
  const [isLobbyLoading, setIsLobbyLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<{ roomId: string; userId: string } | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const manualCloseRef = useRef(false);
  const voiceSignalHandlerRef = useRef<((signal: VoiceSignal) => void) | null>(null);

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(handle);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connectSocket = useCallback((roomId: string, nextUserId: string, isReconnect = false) => {
    clearReconnectTimer();
    const previousSocket = socketRef.current;
    if (previousSocket) {
      previousSocket.onclose = null;
      previousSocket.close();
    }

    manualCloseRef.current = false;
    sessionRef.current = { roomId, userId: nextUserId };
    setConnectionStatus(isReconnect ? "reconnecting" : "connecting");

    const socket = new WebSocket(
      `${config.wsBaseUrl}/ws?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(nextUserId)}`,
    );

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnectionStatus("connected");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "room_state") {
        if (!message.data) {
          manualCloseRef.current = true;
          clearReconnectTimer();
          socket.close();
          setConnectionStatus("idle");
          setRoom(null);
          setUserId(null);
          clearStoredSession(sessionRef.current?.roomId);
          sessionRef.current = null;
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
        setRoom(normalizeRoom(message.data as RemoteRoomState, nextUserId));
      }
      if (message.type === "voice_signal") {
        voiceSignalHandlerRef.current?.(message.data as VoiceSignal);
      }
    };

    socket.onclose = () => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      if (manualCloseRef.current) {
        setConnectionStatus("idle");
        return;
      }

      setConnectionStatus("disconnected");
      const nextAttempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = nextAttempt;
      const delay = Math.min(1000 * 2 ** (nextAttempt - 1), 8000);
      reconnectTimerRef.current = window.setTimeout(() => {
        const session = sessionRef.current;
        if (session) {
          connectSocket(session.roomId, session.userId, true);
        }
      }, delay);
    };

    socket.onerror = () => {
      setConnectionStatus("disconnected");
    };

    socketRef.current = socket;
  }, [clearReconnectTimer]);

  useEffect(() => {
    return () => {
      manualCloseRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
    };
  }, [clearReconnectTimer]);

  const createNewRoom = useCallback(async () => {
    socketRef.current?.close();
    socketRef.current = null;
    sessionRef.current = null;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
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
    saveStoredSession(payload.room.roomId, payload.userId);
    setUserId(payload.userId);
    setRoom(normalizeRoom(payload.room, payload.userId));
    window.history.replaceState({}, "", `${window.location.pathname}?room=${payload.room.roomId}`);
    connectSocket(payload.room.roomId, payload.userId);
  }, [clearReconnectTimer, connectSocket, draftCategory, draftMaxParticipants]);

  const refreshLobbyRooms = useCallback(async () => {
    setIsLobbyLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/rooms`);
      if (!response.ok) return;
      setLobbyRooms((await response.json()) as LobbyRoom[]);
    } catch {
      setLobbyRooms([]);
    } finally {
      setIsLobbyLoading(false);
    }
  }, []);

  const joinRoom = useCallback(async (roomId: string) => {
    const payload = await requestJoinRoom(roomId);
    if (!payload) {
      setRoom(null);
      setUserId(null);
      clearStoredSession(roomId);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    saveStoredSession(payload.room.roomId, payload.userId);
    setUserId(payload.userId);
    setRoom(normalizeRoom(payload.room, payload.userId));
    window.history.replaceState({}, "", `${window.location.pathname}?room=${payload.room.roomId}`);
    connectSocket(payload.room.roomId, payload.userId);
  }, [connectSocket]);

  useEffect(() => {
    if (room) return;
    void refreshLobbyRooms();
    const handle = window.setInterval(() => void refreshLobbyRooms(), 3000);
    return () => window.clearInterval(handle);
  }, [refreshLobbyRooms, room]);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get("room");
    if (!roomId || room || userId) return;

    const storedSession = readStoredSession();
    if (storedSession?.roomId === roomId) {
      setUserId(storedSession.userId);
      connectSocket(storedSession.roomId, storedSession.userId);
      return;
    }

    void joinRoom(roomId);
  }, [connectSocket, joinRoom, room, userId]);

  const send = useCallback((type: string, data?: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type, data }));
  }, []);

  const sendVoiceSignal = useCallback(
    (target: string, signalType: VoiceSignal["signalType"], payload?: unknown) => {
      send("voice_signal", { target, signalType, payload });
    },
    [send],
  );

  const setVoiceSignalHandler = useCallback((handler: ((signal: VoiceSignal) => void) | null) => {
    voiceSignalHandlerRef.current = handler;
  }, []);

  return useMemo(
    () => ({
      room,
      now,
      draftCategory,
      draftMaxParticipants,
      lobbyRooms,
      isLobbyLoading,
      connectionStatus,
      userId,
      setCategory: setDraftCategory,
      setMaxParticipants: setDraftMaxParticipants,
      createNewRoom,
      joinRoom,
      refreshLobbyRooms,
      closeRoom: () => {
        const roomId = sessionRef.current?.roomId ?? room?.roomId;
        manualCloseRef.current = true;
        clearReconnectTimer();
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "leave_room" }));
        }
        sessionRef.current = null;
        reconnectAttemptRef.current = 0;
        socket?.close();
        socketRef.current = null;
        setConnectionStatus("idle");
        setRoom(null);
        setUserId(null);
        clearStoredSession(roomId);
        window.history.replaceState({}, "", window.location.pathname);
      },
      start: () => send("start_room"),
      requestLocalSpeak: () => send("request_speak"),
      requestSide: (side: DebateSide) => send("request_side", { side }),
      endLocalSpeaking: () => send("end_speak"),
      sendVoiceSignal,
      setVoiceSignalHandler,
    }),
    [
      clearReconnectTimer,
      connectionStatus,
      createNewRoom,
      draftCategory,
      draftMaxParticipants,
      isLobbyLoading,
      joinRoom,
      lobbyRooms,
      now,
      refreshLobbyRooms,
      room,
      send,
      sendVoiceSignal,
      setVoiceSignalHandler,
      userId,
    ],
  );
}

interface StoredRoomSession {
  roomId: string;
  userId: string;
}

function readStoredSession(): StoredRoomSession | null {
  try {
    const value = window.localStorage.getItem(roomSessionStorageKey);
    return value ? (JSON.parse(value) as StoredRoomSession) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(roomId: string, userId: string) {
  window.localStorage.setItem(roomSessionStorageKey, JSON.stringify({ roomId, userId }));
}

function clearStoredSession(roomId?: string) {
  const storedSession = readStoredSession();
  if (!storedSession || (roomId && storedSession.roomId !== roomId)) {
    return;
  }
  window.localStorage.removeItem(roomSessionStorageKey);
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
