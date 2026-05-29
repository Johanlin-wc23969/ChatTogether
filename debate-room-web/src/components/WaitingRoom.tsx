import { Copy, LogOut, Play } from "lucide-react";
import { categoryNames } from "../domain/content";
import type { RoomState } from "../domain/types";
import { PersonaAvatar } from "./PersonaAvatar";

interface WaitingRoomProps {
  room: RoomState;
  inviteUrl: string;
  userId: string | null;
  onCopyInvite: () => void;
  onStartRoom: () => void;
  onCloseRoom: () => void;
}

export function WaitingRoom({
  room,
  inviteUrl,
  userId,
  onCopyInvite,
  onStartRoom,
  onCloseRoom,
}: WaitingRoomProps) {
  const currentParticipant = room.participants.find((participant) => participant.id === userId);
  const isHost = Boolean(currentParticipant?.isHost);
  const onlineParticipants = room.participants.filter((participant) => participant.isOnline);
  const isFull = onlineParticipants.length === room.maxParticipants;

  return (
    <section className="waiting-screen">
      <header className="waiting-header">
        <div>
          <p className="eyebrow">{categoryNames[room.category]}</p>
          <h2>{room.topic.title}</h2>
          <p>等待玩家进入</p>
        </div>
      </header>

      <section className="waiting-avatars" aria-label="房间玩家">
        {room.participants.map((participant) => (
          <article className="waiting-avatar-card" key={participant.id}>
            <PersonaAvatar
              className={`${participant.id === userId ? "is-local-avatar" : ""} ${participant.isOnline ? "" : "is-offline"}`}
              persona={participant.persona}
              size="large"
            />
          </article>
        ))}
      </section>

      <div className="invite-link-row">
        <input value={inviteUrl} readOnly aria-label="邀请链接" onFocus={(event) => event.target.select()} />
      </div>

      <footer className="waiting-actions">
        <button type="button" onClick={onCopyInvite}>
          <Copy size={18} />
          复制邀请链接
        </button>
        {isHost ? (
          <button className="primary-inline" type="button" onClick={onStartRoom} disabled={!isFull}>
            <Play size={18} />
            {isFull ? "开始辩论" : "满员后开始"}
          </button>
        ) : null}
        <button type="button" onClick={onCloseRoom} aria-label="关闭房间">
          <LogOut size={18} />
        </button>
      </footer>
    </section>
  );
}
