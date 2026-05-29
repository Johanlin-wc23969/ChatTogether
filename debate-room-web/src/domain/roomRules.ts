import { personas, pickTopic } from "./content";
import type { DebateSide, Participant, RoomState, TopicCategory } from "./types";

export const LOCAL_USER_ID = "you";
const SPEAKING_MS = 60_000;
const COOLDOWN_MS = 30_000;
const SIDE_WAIT_MS = 10_000;

export function createRoom(category: TopicCategory = "technology", maxParticipants = 4): RoomState {
  const room: RoomState = {
    roomId: `ROOM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    category,
    maxParticipants,
    status: "waiting",
    currentSide: "pro",
    currentSpeakerId: null,
    speakingEndsAt: null,
    sideWaitingSince: null,
    topic: pickTopic(category),
    participants: [],
    proQueue: [],
    conQueue: [],
    cooldownUntil: 0,
  };

  room.participants.push(createParticipant(room, LOCAL_USER_ID, true));
  return room;
}

export function createParticipant(room: RoomState, id: string, isHost = false): Participant {
  const usedPersonaIds = new Set(room.participants.map((participant) => participant.persona.id));
  const persona = personas.find((item) => !usedPersonaIds.has(item.id)) ?? personas[0];

  return {
    id,
    isHost,
    side: chooseBalancedSide(room),
    persona,
    joinedAt: Date.now(),
  };
}

export function addMockParticipant(room: RoomState): RoomState {
  if (room.participants.length >= room.maxParticipants || room.status === "active") {
    return room;
  }

  const nextRoom = cloneRoom(room);
  nextRoom.participants.push(
    createParticipant(nextRoom, `bot-${Math.random().toString(36).slice(2, 7)}`),
  );
  balanceSides(nextRoom);
  return nextRoom;
}

export function changeCategory(room: RoomState, category: TopicCategory): RoomState {
  return {
    ...room,
    category,
    topic: pickTopic(category),
  };
}

export function changeMaxParticipants(room: RoomState, maxParticipants: number): RoomState {
  const nextRoom = cloneRoom(room);
  nextRoom.maxParticipants = maxParticipants;
  if (nextRoom.participants.length > maxParticipants) {
    nextRoom.participants = nextRoom.participants.slice(0, maxParticipants);
    removeMissingQueuedUsers(nextRoom);
  }
  return nextRoom;
}

export function startRoom(room: RoomState): RoomState {
  if (room.participants.length < 3 || room.status === "active") {
    return room;
  }

  const nextRoom = {
    ...room,
    status: "active" as const,
    currentSide: "pro" as const,
  };
  return tryStartNextSpeaker(nextRoom);
}

export function requestSpeak(room: RoomState, userId: string, now = Date.now()): RoomState {
  const participant = room.participants.find((item) => item.id === userId);
  if (!participant || room.status !== "active") {
    return room;
  }

  if (room.currentSpeakerId === userId || now < room.cooldownUntil) {
    return room;
  }

  const nextRoom = cloneRoom(room);
  const queue = queueForSide(nextRoom, participant.side);
  if (queue.includes(userId)) {
    return room;
  }

  queue.push(userId);
  if (userId === LOCAL_USER_ID) {
    nextRoom.cooldownUntil = now + COOLDOWN_MS;
  }

  return !nextRoom.currentSpeakerId && nextRoom.currentSide === participant.side
    ? tryStartNextSpeaker(nextRoom, now)
    : nextRoom;
}

export function requestSideSpeak(room: RoomState, side: DebateSide): RoomState {
  const nextRoom = cloneRoom(room);
  const queue = queueForSide(nextRoom, side);
  const candidate = nextRoom.participants.find(
    (participant) =>
      participant.side === side &&
      participant.id !== nextRoom.currentSpeakerId &&
      !queue.includes(participant.id),
  );

  if (!candidate) {
    return room;
  }

  queue.push(candidate.id);
  return nextRoom.status === "active" && !nextRoom.currentSpeakerId && nextRoom.currentSide === side
    ? tryStartNextSpeaker(nextRoom)
    : nextRoom;
}

export function endSpeaking(room: RoomState, now = Date.now()): RoomState {
  if (!room.currentSpeakerId) {
    return room;
  }

  const nextRoom = {
    ...room,
    currentSpeakerId: null,
    speakingEndsAt: null,
    sideWaitingSince: null,
    currentSide: oppositeSide(room.currentSide),
  };

  return tryStartNextSpeaker(nextRoom, now);
}

export function tickRoom(room: RoomState, now = Date.now()): RoomState {
  if (room.currentSpeakerId && room.speakingEndsAt && now >= room.speakingEndsAt) {
    return endSpeaking(room, now);
  }

  if (room.status !== "active" || room.currentSpeakerId) {
    return room;
  }

  const queue = queueForSide(room, room.currentSide);
  if (queue.length > 0) {
    return tryStartNextSpeaker(room, now);
  }

  if (room.sideWaitingSince && now - room.sideWaitingSince >= SIDE_WAIT_MS) {
    const nextRoom = {
      ...room,
      currentSide: oppositeSide(room.currentSide),
      sideWaitingSince: null,
    };
    return tryStartNextSpeaker(nextRoom, now);
  }

  return room;
}

function tryStartNextSpeaker(room: RoomState, now = Date.now()): RoomState {
  if (room.status !== "active" || room.currentSpeakerId) {
    return room;
  }

  const nextRoom = cloneRoom(room);
  const queue = queueForSide(nextRoom, nextRoom.currentSide);
  const nextId = queue.shift();

  if (!nextId) {
    nextRoom.sideWaitingSince = nextRoom.sideWaitingSince ?? now;
    return nextRoom;
  }

  nextRoom.sideWaitingSince = null;
  nextRoom.currentSpeakerId = nextId;
  nextRoom.speakingEndsAt = now + SPEAKING_MS;
  return nextRoom;
}

function chooseBalancedSide(room: RoomState): DebateSide {
  const proCount = room.participants.filter((participant) => participant.side === "pro").length;
  const conCount = room.participants.filter((participant) => participant.side === "con").length;

  if (proCount < conCount) return "pro";
  if (conCount < proCount) return "con";
  return Math.random() > 0.5 ? "pro" : "con";
}

function balanceSides(room: RoomState) {
  const targetPro = Math.ceil(room.participants.length / 2);
  const pro = room.participants.filter((participant) => participant.side === "pro");
  const con = room.participants.filter((participant) => participant.side === "con");

  while (pro.length > targetPro && con.length < room.participants.length - targetPro) {
    const participant = pro.pop();
    if (participant) {
      participant.side = "con";
      con.push(participant);
    }
  }

  while (pro.length < targetPro && con.length > room.participants.length - targetPro) {
    const participant = con.pop();
    if (participant) {
      participant.side = "pro";
      pro.push(participant);
    }
  }
}

function removeMissingQueuedUsers(room: RoomState) {
  const ids = new Set(room.participants.map((participant) => participant.id));
  room.proQueue = room.proQueue.filter((id) => ids.has(id));
  room.conQueue = room.conQueue.filter((id) => ids.has(id));
}

function queueForSide(room: RoomState, side: DebateSide) {
  return side === "pro" ? room.proQueue : room.conQueue;
}

function oppositeSide(side: DebateSide): DebateSide {
  return side === "pro" ? "con" : "pro";
}

function cloneRoom(room: RoomState): RoomState {
  return {
    ...room,
    participants: room.participants.map((participant) => ({ ...participant })),
    proQueue: [...room.proQueue],
    conQueue: [...room.conQueue],
  };
}
