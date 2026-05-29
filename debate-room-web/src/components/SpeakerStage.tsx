import type { RoomState } from "../domain/types";
import { PersonaAvatar } from "./PersonaAvatar";

interface SpeakerStageProps {
  room: RoomState;
}

export function SpeakerStage({ room }: SpeakerStageProps) {
  const speaker = room.participants.find((participant) => participant.id === room.currentSpeakerId);

  return (
    <section className="speaker-stage">
      <PersonaAvatar persona={speaker?.persona} size="medium" className="persona-orb" />
      <div>
        <p>
          {speaker
            ? speaker.side === "pro"
              ? "正方发言中"
              : "反方发言中"
            : room.status === "active"
              ? "等待申请发言"
              : "等待房主开始"}
        </p>
        <h3>
          {speaker
            ? `${speaker.persona.name}${speaker.id === "you" ? "（你）" : ""}`
            : "暂无发言"}
        </h3>
      </div>
    </section>
  );
}
