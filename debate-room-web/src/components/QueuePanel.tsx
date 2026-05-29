import type { RoomState } from "../domain/types";

interface QueuePanelProps {
  room: RoomState;
}

export function QueuePanel({ room }: QueuePanelProps) {
  return (
    <section className="queue-panel">
      <div>
        <span>正方队列</span>
        <strong>{formatQueue(room, room.proQueue)}</strong>
      </div>
      <div>
        <span>反方队列</span>
        <strong>{formatQueue(room, room.conQueue)}</strong>
      </div>
    </section>
  );
}

function formatQueue(room: RoomState, queue: string[]) {
  if (!queue.length) return "空";

  return queue
    .map((id) => room.participants.find((participant) => participant.id === id)?.persona.name ?? "离线")
    .join("、");
}
