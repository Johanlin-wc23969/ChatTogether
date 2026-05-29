import type { DebateSide, Participant } from "../domain/types";
import { PersonaAvatar } from "./PersonaAvatar";

interface ParticipantListProps {
  title: string;
  side: DebateSide;
  participants: Participant[];
  currentSpeakerId: string | null;
  onRequestSide: (side: DebateSide) => void;
}

export function ParticipantList({
  title,
  side,
  participants,
  currentSpeakerId,
  onRequestSide,
}: ParticipantListProps) {
  return (
    <div className={`side-column ${side === "pro" ? "pro-side" : "con-side"}`}>
      <div className="side-title">
        <span>{title}</span>
        <button type="button" onClick={() => onRequestSide(side)}>
          {title}排队
        </button>
      </div>

      <div className="participant-list">
        {participants.map((participant) => (
          <article
            className={`participant-card ${
              participant.id === currentSpeakerId ? "speaking" : ""
            }`}
            key={participant.id}
          >
            <PersonaAvatar persona={participant.persona} size="small" className="mini-avatar" />
            <div>
              <strong>
                {participant.persona.name}
                {participant.id === "you" ? "（你）" : ""}
              </strong>
              <span>
                {participant.persona.voice}
                {participant.isHost ? " · 房主" : ""}
              </span>
            </div>
            <div className="badge">{side === "pro" ? "正方" : "反方"}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
