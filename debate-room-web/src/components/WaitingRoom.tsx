import { Copy, LogOut, Play, Plus } from "lucide-react";
import { categoryNames } from "../domain/content";
import type { RoomState } from "../domain/types";
import { PersonaAvatar } from "./PersonaAvatar";

interface WaitingRoomProps {
  room: RoomState;
  inviteUrl: string;
  onCopyInvite: () => void;
  onAddParticipant: () => void;
  onStartRoom: () => void;
  onCloseRoom: () => void;
}

export function WaitingRoom({
  room,
  inviteUrl,
  onCopyInvite,
  onAddParticipant,
  onStartRoom,
  onCloseRoom,
}: WaitingRoomProps) {
  return (
    <section className="waiting-screen">
      <header className="waiting-header">
        <div>
          <p className="eyebrow">{categoryNames[room.category]}</p>
          <h2>{room.topic.title}</h2>
          <p>等待玩家进入</p>
        </div>
        <div className="waiting-count">
          <strong>
            {room.participants.length}/{room.maxParticipants}
          </strong>
          <span>已加入</span>
        </div>
      </header>

      <section className="waiting-avatars" aria-label="房间玩家">
        {room.participants.map((participant) => (
          <article className="waiting-avatar-card" key={participant.id}>
            <PersonaAvatar persona={participant.persona} size="large" />
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
        <button
          type="button"
          onClick={onAddParticipant}
          disabled={room.participants.length >= room.maxParticipants}
        >
          <Plus size={18} />
          加入测试用户
        </button>
        <button className="primary-inline" type="button" onClick={onStartRoom}>
          <Play size={18} />
          开始辩论
        </button>
        <button type="button" onClick={onCloseRoom} aria-label="关闭房间">
          <LogOut size={18} />
        </button>
      </footer>
    </section>
  );
}
