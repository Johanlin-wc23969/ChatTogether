import { categoryNames } from "../domain/content";
import type { RoomState } from "../domain/types";

interface DebateTopicHeaderProps {
  room: RoomState;
}

export function DebateTopicHeader({ room }: DebateTopicHeaderProps) {
  return (
    <header className="topic-board">
      <div>
        <p className="eyebrow">{categoryNames[room.category]}</p>
        <h2>{room.topic.title}</h2>
      </div>
      <div className="topic-positions">
        <span>{room.topic.pro}</span>
        <span>{room.topic.con}</span>
      </div>
    </header>
  );
}
