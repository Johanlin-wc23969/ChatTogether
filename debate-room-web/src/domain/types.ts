export type DebateSide = "unassigned" | "pro" | "con";
export type RoomStatus = "waiting" | "active" | "ended";
export type TopicCategory =
  | "technology"
  | "society"
  | "workplace"
  | "campus"
  | "relationship"
  | "entertainment";

export interface DebateTopic {
  title: string;
  pro: string;
  con: string;
}

export interface Persona {
  id: string;
  name: string;
  icon: string;
  voice: string;
}

export interface Participant {
  id: string;
  isHost: boolean;
  side: DebateSide;
  persona: Persona;
  joinedAt: number;
  isOnline: boolean;
  disconnectedAt: number | null;
}

export interface RoomState {
  roomId: string;
  category: TopicCategory;
  maxParticipants: number;
  status: RoomStatus;
  currentSide: DebateSide;
  currentSpeakerId: string | null;
  speakingEndsAt: number | null;
  sideWaitingSince: number | null;
  topic: DebateTopic;
  participants: Participant[];
  proQueue: string[];
  conQueue: string[];
  cooldownUntil: number;
}
