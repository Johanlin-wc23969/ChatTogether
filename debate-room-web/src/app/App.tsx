import { useState } from "react";
import { ActiveDebateRoom } from "../components/ActiveDebateRoom";
import { CreateRoomPanel } from "../components/CreateRoomPanel";
import { Toast } from "../components/Toast";
import { WaitingRoom } from "../components/WaitingRoom";
import type { ConnectionStatus } from "./useRemoteRoom";
import { useRemoteRoom } from "./useRemoteRoom";
import { useRoomVoice } from "./useRoomVoice";
import "./app.css";

export function App() {
  const roomApi = useRemoteRoom();
  const voice = useRoomVoice(
    roomApi.room,
    roomApi.userId,
    roomApi.sendVoiceSignal,
    roomApi.setVoiceSignalHandler,
  );
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const inviteUrl = roomApi.room
    ? `${window.location.origin}${window.location.pathname}?room=${roomApi.room.roomId}`
    : `${window.location.origin}${window.location.pathname}`;

  const copyInvite = async () => {
    const copied = await copyText(inviteUrl);
    if (copied) {
      showToast("邀请链接已复制");
    } else {
      showToast("复制失败，请手动复制链接");
    }
  };

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Web MVP</p>
          <h1>匿名辩论房</h1>
        </div>
        <div className="topbar-meta">
          {roomApi.room ? <ConnectionBadge status={roomApi.connectionStatus} /> : null}
          <div className="room-code">{roomApi.room?.roomId ?? "未创建"}</div>
        </div>
      </section>

      {!roomApi.room ? (
        <CreateRoomPanel
          category={roomApi.draftCategory}
          maxParticipants={roomApi.draftMaxParticipants}
          onCategoryChange={roomApi.setCategory}
          onMaxParticipantsChange={roomApi.setMaxParticipants}
          onCreateRoom={() => {
            roomApi.createNewRoom();
            showToast("房间已创建");
          }}
        />
      ) : roomApi.room.status === "waiting" ? (
        <WaitingRoom
          room={roomApi.room}
          inviteUrl={inviteUrl}
          userId={roomApi.userId}
          onCopyInvite={copyInvite}
          onCloseRoom={roomApi.closeRoom}
          onStartRoom={() => {
            if (!roomApi.room || roomApi.room.participants.length !== roomApi.room.maxParticipants) {
              showToast("房间满员后可以开始");
              return;
            }
            roomApi.start();
          }}
        />
      ) : (
        <ActiveDebateRoom
          room={roomApi.room}
          now={roomApi.now}
          userId={roomApi.userId}
          onRequestLocalSpeak={roomApi.requestLocalSpeak}
          onEndLocalSpeaking={roomApi.endLocalSpeaking}
          voiceStatus={voice.voiceStatus}
          voiceError={voice.voiceError}
        />
      )}

      <Toast message={toast} />
    </main>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return <div className={`connection-badge connection-${status}`}>{connectionLabel(status)}</div>;
}

function connectionLabel(status: ConnectionStatus) {
  if (status === "connecting") return "连接中";
  if (status === "connected") return "已连接";
  if (status === "reconnecting") return "正在重连";
  if (status === "disconnected") return "连接中断";
  return "未连接";
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback for browsers that block clipboard permissions.
    }
  }

  const visibleInput = document.querySelector<HTMLInputElement>('input[aria-label="邀请链接"]');
  if (visibleInput) {
    visibleInput.focus();
    visibleInput.select();
    visibleInput.setSelectionRange(0, visibleInput.value.length);
    try {
      if (document.execCommand("copy")) {
        return true;
      }
    } catch {
      // Continue to the hidden textarea fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
