import { RefreshCw } from "lucide-react";
import { categoryNames, topicCategories } from "../domain/content";
import type { TopicCategory } from "../domain/types";

interface CreateRoomPanelProps {
  category: TopicCategory;
  maxParticipants: number;
  onCategoryChange: (category: TopicCategory) => void;
  onMaxParticipantsChange: (size: number) => void;
  onCreateRoom: () => void;
}

export function CreateRoomPanel({
  category,
  maxParticipants,
  onCategoryChange,
  onMaxParticipantsChange,
  onCreateRoom,
}: CreateRoomPanelProps) {
  return (
    <section className="create-screen" aria-label="创建房间">
      <div className="create-card">
      <div className="panel-heading">
        <h2>创建房间</h2>
        <p>本地原型</p>
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
          {[3, 4, 5, 6].map((size) => (
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
