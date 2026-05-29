import { DebateTopicHeader } from "./DebateTopicHeader";
import { ParticipantList } from "./ParticipantList";
import { QueuePanel } from "./QueuePanel";
import { RoomStatusStrip } from "./RoomStatusStrip";
import { SpeakActionBar } from "./SpeakActionBar";
import { SpeakerStage } from "./SpeakerStage";
import type { DebateSide, RoomState } from "../domain/types";

interface DebateRoomProps {
  room: RoomState;
  now: number;
  onRequestLocalSpeak: () => void;
  onEndLocalSpeaking: () => void;
  onRequestSide: (side: DebateSide) => void;
}

export function DebateRoom({
  room,
  now,
  onRequestLocalSpeak,
  onEndLocalSpeaking,
  onRequestSide,
}: DebateRoomProps) {
  const proParticipants = room.participants.filter((participant) => participant.side === "pro");
  const conParticipants = room.participants.filter((participant) => participant.side === "con");

  return (
    <section className="room-panel" aria-label="辩论房间">
      <DebateTopicHeader room={room} />
      <RoomStatusStrip room={room} now={now} />
      <SpeakerStage room={room} />

      <section className="sides-grid">
        <ParticipantList
          title="正方"
          side="pro"
          participants={proParticipants}
          currentSpeakerId={room.currentSpeakerId}
          onRequestSide={onRequestSide}
        />
        <ParticipantList
          title="反方"
          side="con"
          participants={conParticipants}
          currentSpeakerId={room.currentSpeakerId}
          onRequestSide={onRequestSide}
        />
      </section>

      <QueuePanel room={room} />
      <SpeakActionBar
        room={room}
        now={now}
        onRequestLocalSpeak={onRequestLocalSpeak}
        onEndLocalSpeaking={onEndLocalSpeaking}
      />
    </section>
  );
}
