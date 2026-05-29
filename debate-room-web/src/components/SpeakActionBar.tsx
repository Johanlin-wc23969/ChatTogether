import { Mic, Square } from "lucide-react";
import { LOCAL_USER_ID } from "../domain/roomRules";
import type { RoomState } from "../domain/types";

interface SpeakActionBarProps {
  room: RoomState;
  now: number;
  onRequestLocalSpeak: () => void;
  onEndLocalSpeaking: () => void;
}

export function SpeakActionBar({
  room,
  now,
  onRequestLocalSpeak,
  onEndLocalSpeaking,
}: SpeakActionBarProps) {
  const isSpeaking = room.currentSpeakerId === LOCAL_USER_ID;
  const isQueued = room.proQueue.includes(LOCAL_USER_ID) || room.conQueue.includes(LOCAL_USER_ID);
  const cooldownLeft = Math.max(0, Math.ceil((room.cooldownUntil - now) / 1000));

  const disabled = room.status !== "active" || isSpeaking || isQueued || cooldownLeft > 0;

  return (
    <footer className="action-bar">
      <button className="speak-button" type="button" onClick={onRequestLocalSpeak} disabled={disabled}>
        <Mic size={20} />
        {getSpeakLabel(room, isSpeaking, isQueued, cooldownLeft)}
      </button>
      <button
        className="end-button"
        type="button"
        onClick={onEndLocalSpeaking}
        disabled={!isSpeaking}
      >
        <Square size={18} />
        结束发言
      </button>
    </footer>
  );
}

function getSpeakLabel(room: RoomState, isSpeaking: boolean, isQueued: boolean, cooldownLeft: number) {
  if (room.status !== "active") return "等待开始";
  if (isSpeaking) return "正在发言";
  if (isQueued) return "排队中";
  if (cooldownLeft > 0) return `冷却 ${cooldownLeft}s`;
  return "申请发言";
}
