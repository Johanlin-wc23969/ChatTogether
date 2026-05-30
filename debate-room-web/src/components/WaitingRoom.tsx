import { Copy, Crown, LogOut, Play, UserRound } from "lucide-react";
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
  const emptySlotCount = Math.max(0, room.maxParticipants - room.participants.length);
  const missingCount = Math.max(0, room.maxParticipants - onlineParticipants.length);

  return (
    <section className="waiting-screen">
      <header className="waiting-header">
        <div>
          <span className="waiting-topic-label">{categoryNames[room.category]}</span>
          <h2>{room.topic.title}</h2>
          <p>等待玩家进入</p>
        </div>
      </header>

      <section className="waiting-party" aria-label="房间玩家">
        <div className="waiting-party-heading">
          <div>
            <span>Players</span>
            <strong>
              {onlineParticipants.length}/{room.maxParticipants}
            </strong>
          </div>
          <p>{isFull ? "队伍已满，可以开始" : `还差 ${missingCount} 人开始`}</p>
        </div>
        <div className="waiting-avatars">
          {room.participants.map((participant) => (
            <article className="waiting-avatar-card" key={participant.id}>
              <PersonaAvatar
                className={`${participant.id === userId ? "is-local-avatar" : ""} ${participant.isOnline ? "" : "is-offline"}`}
                persona={participant.persona}
                size="large"
              />
              <div className="waiting-avatar-badges">
                {participant.isHost ? (
                  <span className="host-badge">
                    <Crown size={13} />
                    房主
                  </span>
                ) : null}
                {participant.id === userId ? (
                  <span className="self-badge">
                    <UserRound size={13} />
                    你
                  </span>
                ) : null}
              </div>
            </article>
          ))}
          {Array.from({ length: emptySlotCount }).map((_, index) => (
            <article className="waiting-avatar-card waiting-empty-slot" key={`empty-${index}`}>
              <span>?</span>
            </article>
          ))}
        </div>
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
            {isFull ? "开始辩论" : `还差 ${missingCount} 人`}
          </button>
        ) : null}
        <button type="button" onClick={onCloseRoom} aria-label="关闭房间">
          <LogOut size={18} />
        </button>
      </footer>
    </section>
  );
}
