import { RefreshCw, RotateCw, Users } from "lucide-react";
import { categoryNames, topicCategories } from "../domain/content";
import type { TopicCategory } from "../domain/types";
import type { LobbyRoom } from "../app/useRemoteRoom";

interface CreateRoomPanelProps {
  category: TopicCategory;
  maxParticipants: number;
  onCategoryChange: (category: TopicCategory) => void;
  onMaxParticipantsChange: (size: number) => void;
  onCreateRoom: () => void;
  lobbyRooms: LobbyRoom[];
  isLobbyLoading: boolean;
  onJoinRoom: (roomId: string) => void;
  onRefreshRooms: () => void;
}

export function CreateRoomPanel({
  category,
  maxParticipants,
  onCategoryChange,
  onMaxParticipantsChange,
  onCreateRoom,
  lobbyRooms,
  isLobbyLoading,
  onJoinRoom,
  onRefreshRooms,
}: CreateRoomPanelProps) {
  return (
    <section className="create-screen lobby-screen" aria-label="大厅">
      <div className="lobby-panel">
        <div className="panel-heading lobby-heading">
          <div>
            <h2>大厅</h2>
            <p>当前可加入的匿名辩论房</p>
          </div>
          <button type="button" onClick={onRefreshRooms} aria-label="刷新房间列表">
            <RotateCw size={17} />
          </button>
        </div>

        <div className="room-list" aria-label="当前房间">
          {lobbyRooms.length === 0 ? (
            <div className="empty-lobby">暂无房间</div>
          ) : (
            lobbyRooms.map((room) => (
              <article className="room-list-item" key={room.roomId}>
                <div>
                  <p className="eyebrow">{categoryNames[room.category]}</p>
                  <h3>{room.topicTitle}</h3>
                  <span>{room.roomId}</span>
                </div>
                <div className="room-list-meta">
                  <strong>
                    {room.onlineCount}/{room.maxParticipants}
                  </strong>
                  <span>{room.status === "waiting" ? "等待中" : "辩论中"}</span>
                </div>
                <button type="button" onClick={() => onJoinRoom(room.roomId)} disabled={!room.canJoin}>
                  <Users size={17} />
                  {room.canJoin ? "加入" : "不可加入"}
                </button>
              </article>
            ))
          )}
        </div>
        {isLobbyLoading ? <p className="lobby-loading">正在刷新</p> : null}
      </div>

      <div className="create-card">
        <div className="panel-heading">
          <h2>创建房间</h2>
          <p>2-6 人</p>
        </div>

        <label className="field">
          <span>主题分类</span>
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value as TopicCategory)}
          >
            {topicCategories.map((category) => (
              <option key={category} value={category}>
                {categoryNames[category]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="field">
          <legend>人数上限</legend>
          <div className="segmented">
            {[2, 3, 4, 5, 6].map((size) => (
              <button
                key={size}
                type="button"
                className={maxParticipants === size ? "active" : ""}
                onClick={() => onMaxParticipantsChange(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </fieldset>

        <button className="primary-action" type="button" onClick={onCreateRoom}>
          <RefreshCw size={18} />
          创建房间
        </button>
      </div>
    </section>
  );
}
