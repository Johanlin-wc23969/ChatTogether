import type { RoomState } from "../domain/types";

interface RoomStatusStripProps {
  room: RoomState;
  now: number;
}

export function RoomStatusStrip({ room, now }: RoomStatusStripProps) {
  const secondsLeft =
    room.currentSpeakerId && room.speakingEndsAt
      ? Math.max(0, Math.ceil((room.speakingEndsAt - now) / 1000))
      : null;

  return (
    <div className="status-strip">
      <div>
        <span>房间</span>
        <strong>{room.status === "active" ? "辩论中" : "等待中"}</strong>
      </div>
      <div>
        <span>当前轮次</span>
        <strong>{room.currentSide === "pro" ? "正方" : "反方"}</strong>
      </div>
      <div>
        <span>倒计时</span>
        <strong>{secondsLeft === null ? "--" : `${secondsLeft}s`}</strong>
      </div>
    </div>
  );
}
