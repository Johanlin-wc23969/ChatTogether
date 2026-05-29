import { Mic, Square } from "lucide-react";
import type { VoiceStatus } from "../app/useRoomVoice";
import type { DebateSide, Participant, RoomState } from "../domain/types";
import { PersonaAvatar } from "./PersonaAvatar";

interface ActiveDebateRoomProps {
  room: RoomState;
  now: number;
  userId: string | null;
  onRequestLocalSpeak: () => void;
  onEndLocalSpeaking: () => void;
  voiceStatus: VoiceStatus;
  voiceError: string;
}

export function ActiveDebateRoom({
  room,
  now,
  userId,
  onRequestLocalSpeak,
  onEndLocalSpeaking,
  voiceStatus,
  voiceError,
}: ActiveDebateRoomProps) {
  const speaker = room.participants.find((participant) => participant.id === room.currentSpeakerId);
  const currentParticipant = room.participants.find((participant) => participant.id === userId);
  const secondsLeft =
    room.currentSpeakerId && room.speakingEndsAt
      ? Math.max(0, Math.ceil((room.speakingEndsAt - now) / 1000))
      : null;
  const isSpeaking = Boolean(userId && room.currentSpeakerId === userId);
  const isQueued = Boolean(userId && (room.proQueue.includes(userId) || room.conQueue.includes(userId)));
  const cooldownLeft = Math.max(0, Math.ceil((room.cooldownUntil - now) / 1000));
  const speakDisabled = isSpeaking || isQueued || cooldownLeft > 0;

  return (
    <section className="active-room">
      <header className="active-topic">
        <h2>{room.topic.title}</h2>
      </header>

      <section className="current-speaker" aria-label="当前发言人">
        <div className="speaker-identity">
          <PersonaAvatar
            persona={speaker?.persona}
            size="hero"
            className={`speaker-avatar ${speaker?.side === "con" ? "con-avatar" : "pro-avatar"}`}
          />
          <span>
            {speaker
              ? speaker.side === "pro"
                ? "正方发言"
                : "反方发言"
              : room.currentSide === "pro"
                ? "等待正方发言"
                : "等待反方发言"}
          </span>
        </div>
        <div className="speaker-timer" aria-label="发言倒计时">
          <strong>{secondsLeft === null ? "--" : secondsLeft}</strong>
          <span>{secondsLeft === null ? "等待队列" : "秒"}</span>
        </div>
      </section>

      <section className="side-members-board" aria-label="双方阵营">
        <SideMembers title="正方" side="pro" room={room} />
        <SideMembers title="反方" side="con" room={room} />
      </section>

      <footer className="active-actions">
        <div className={`voice-state voice-${voiceStatus}`} aria-live="polite">
          {voiceError || voiceStatusLabel(voiceStatus, isSpeaking, Boolean(speaker))}
        </div>
        <button type="button" onClick={onRequestLocalSpeak} disabled={speakDisabled}>
          <Mic size={20} />
          {speakLabel(currentParticipant?.side, isSpeaking, isQueued, cooldownLeft)}
        </button>
        <button type="button" onClick={onEndLocalSpeaking} disabled={!isSpeaking}>
          <Square size={18} />
          结束发言
        </button>
      </footer>
    </section>
  );
}

interface SideMembersProps {
  title: string;
  side: DebateSide;
  room: RoomState;
}

function SideMembers({ title, side, room }: SideMembersProps) {
  const queue = side === "pro" ? room.proQueue : room.conQueue;
  const { priorityMembers, idleMembers } = splitSideMembers(room, side, queue);

  return (
    <div className={`side-members ${side === "pro" ? "pro-side" : "con-side"}`}>
      <div className="side-members-heading">
        <span>{title}</span>
      </div>
      <div className="side-member-main">
        {priorityMembers.map((participant) => (
          <PersonaAvatar
            className={`side-member-avatar ${avatarStateClass(room, queue, participant.id)}`}
            key={participant.id}
            persona={participant.persona}
            size="small"
          />
        ))}
      </div>
      <div className="side-member-idle">
        {idleMembers.map((participant) => (
          <PersonaAvatar
            className="side-member-avatar idle-avatar"
            key={participant.id}
            persona={participant.persona}
            size="small"
          />
        ))}
      </div>
    </div>
  );
}

function splitSideMembers(room: RoomState, side: DebateSide, queue: string[]) {
  const sideMembers = room.participants.filter((participant) => participant.side === side);
  const speaker = sideMembers.find((participant) => participant.id === room.currentSpeakerId);
  const queued = queue
    .map((id) => sideMembers.find((participant) => participant.id === id))
    .filter((participant): participant is Participant => Boolean(participant));
  const highlighted = new Set([speaker?.id, ...queued.map((participant) => participant.id)]);
  const idleMembers = sideMembers.filter((participant) => !highlighted.has(participant.id));

  return {
    priorityMembers: speaker ? [speaker, ...queued] : queued,
    idleMembers,
  };
}

function avatarStateClass(room: RoomState, queue: string[], participantId: string) {
  if (room.currentSpeakerId === participantId) return "is-speaking";
  if (queue.includes(participantId)) return "is-priority";
  return "";
}

function speakLabel(
  side: DebateSide | undefined,
  isSpeaking: boolean,
  isQueued: boolean,
  cooldownLeft: number,
) {
  if (isSpeaking) return "正在发言";
  if (isQueued) return "排队中";
  if (cooldownLeft > 0) return `冷却 ${cooldownLeft}s`;
  if (side === "pro") return "作为正方申请发言";
  if (side === "con") return "作为反方申请发言";
  return "申请发言";
}

function voiceStatusLabel(voiceStatus: VoiceStatus, isSpeaking: boolean, hasSpeaker: boolean) {
  if (!hasSpeaker) return "等待语音连接";
  if (voiceStatus === "connecting") return "正在连接麦克风";
  if (voiceStatus === "connected") return "语音已连接";
  if (voiceStatus === "speaking" || isSpeaking) return "麦克风已开启";
  if (voiceStatus === "listening") return "正在收听发言";
  if (voiceStatus === "blocked") return "麦克风不可用";
  if (voiceStatus === "failed") return "语音连接中断";
  return "语音待机";
}
