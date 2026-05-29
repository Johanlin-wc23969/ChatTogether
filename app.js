const topics = {
  technology: [
    {
      title: "AI 会让普通人的工作机会变多还是变少？",
      pro: "正方：机会变多",
      con: "反方：机会变少",
    },
    {
      title: "自动驾驶普及后，城市是否应该减少私人汽车？",
      pro: "正方：应该减少",
      con: "反方：不应减少",
    },
  ],
  society: [
    {
      title: "匿名社交让人更真诚还是更失控？",
      pro: "正方：更真诚",
      con: "反方：更失控",
    },
    {
      title: "公共场所是否应该全面限制外放声音？",
      pro: "正方：应该限制",
      con: "反方：不应全面限制",
    },
  ],
  workplace: [
    {
      title: "远程办公会提升效率还是削弱协作？",
      pro: "正方：提升效率",
      con: "反方：削弱协作",
    },
    {
      title: "职场新人应该优先追求成长还是稳定？",
      pro: "正方：优先成长",
      con: "反方：优先稳定",
    },
  ],
  campus: [
    {
      title: "大学课程应该更重视通识教育还是职业技能？",
      pro: "正方：通识教育",
      con: "反方：职业技能",
    },
    {
      title: "考试成绩是否仍然是最公平的评价方式？",
      pro: "正方：仍然公平",
      con: "反方：不再公平",
    },
  ],
  relationship: [
    {
      title: "恋爱中坦白一切是否真的必要？",
      pro: "正方：必要",
      con: "反方：不必要",
    },
    {
      title: "朋友之间借钱是否会破坏关系？",
      pro: "正方：会破坏",
      con: "反方：不一定",
    },
  ],
  entertainment: [
    {
      title: "短视频让人更放松还是更焦虑？",
      pro: "正方：更放松",
      con: "反方：更焦虑",
    },
    {
      title: "爆款影视剧是否应该更重视观众评分？",
      pro: "正方：应该重视",
      con: "反方：不应过度重视",
    },
  ],
};

const categoryNames = {
  technology: "科技",
  society: "社会",
  workplace: "职场",
  campus: "校园",
  relationship: "情感",
  entertainment: "娱乐",
};

const personas = [
  { id: "bear", name: "熊", icon: "熊", voice: "低沉厚重" },
  { id: "dog", name: "狗", icon: "狗", voice: "活泼偏高" },
  { id: "cat", name: "猫", icon: "猫", voice: "轻柔尖细" },
  { id: "bird", name: "鸟", icon: "鸟", voice: "清亮快速" },
  { id: "robot", name: "机器人", icon: "机", voice: "电子质感" },
  { id: "alien", name: "外星人", icon: "外", voice: "空间变调" },
];

const initialState = {
  roomId: null,
  category: "technology",
  maxParticipants: 4,
  status: "waiting",
  currentSide: "pro",
  currentSpeakerId: null,
  speakingEndsAt: null,
  sideWaitingSince: null,
  topic: topics.technology[0],
  participants: [],
  proQueue: [],
  conQueue: [],
  cooldownUntil: 0,
};

let state = loadState() || createInitialRoom();
let tickHandle = null;
let toastHandle = null;

const els = {
  roomCode: document.querySelector("#roomCode"),
  categorySelect: document.querySelector("#categorySelect"),
  sizeOptions: document.querySelector("#sizeOptions"),
  createRoomButton: document.querySelector("#createRoomButton"),
  copyInviteButton: document.querySelector("#copyInviteButton"),
  startRoomButton: document.querySelector("#startRoomButton"),
  topicCategory: document.querySelector("#topicCategory"),
  topicTitle: document.querySelector("#topicTitle"),
  proPosition: document.querySelector("#proPosition"),
  conPosition: document.querySelector("#conPosition"),
  roomStatus: document.querySelector("#roomStatus"),
  currentSide: document.querySelector("#currentSide"),
  speakerTimer: document.querySelector("#speakerTimer"),
  speakerAvatar: document.querySelector("#speakerAvatar"),
  speakerLabel: document.querySelector("#speakerLabel"),
  speakerName: document.querySelector("#speakerName"),
  proList: document.querySelector("#proList"),
  conList: document.querySelector("#conList"),
  proQueue: document.querySelector("#proQueue"),
  conQueue: document.querySelector("#conQueue"),
  speakButton: document.querySelector("#speakButton"),
  endSpeakButton: document.querySelector("#endSpeakButton"),
  toast: document.querySelector("#toast"),
};

bindEvents();
render();
startTicker();

function bindEvents() {
  els.categorySelect.addEventListener("change", (event) => {
    state.category = event.target.value;
    state.topic = pickTopic(state.category);
    saveAndRender();
  });

  els.sizeOptions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-size]");
    if (!button) return;
    state.maxParticipants = Number(button.dataset.size);
    if (state.participants.length > state.maxParticipants) {
      state.participants = state.participants.slice(0, state.maxParticipants);
      removeMissingQueuedUsers();
    }
    saveAndRender();
  });

  els.createRoomButton.addEventListener("click", () => {
    state = createInitialRoom();
    saveAndRender();
    showToast("房间已创建");
  });

  els.copyInviteButton.addEventListener("click", async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("邀请链接已复制");
    } catch {
      showToast(url);
    }
  });

  els.startRoomButton.addEventListener("click", () => {
    if (state.participants.length !== state.maxParticipants) {
      showToast("房间满员后可以开始");
      return;
    }
    state.status = "active";
    state.currentSide = "pro";
    tryStartNextSpeaker();
    saveAndRender();
  });

  document.querySelectorAll(".side-request").forEach((button) => {
    button.addEventListener("click", () => requestSideSpeak(button.dataset.side));
  });

  els.speakButton.addEventListener("click", () => requestSpeak("you"));
  els.endSpeakButton.addEventListener("click", () => endSpeaking("manual"));
}

function createInitialRoom() {
  const urlRoom = new URLSearchParams(window.location.search).get("room");
  const roomId = urlRoom || `ROOM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const room = {
    ...initialState,
    roomId,
    participants: [],
  };
  room.participants.push(createParticipant("you", true, room));
  return room;
}

function createParticipant(id, isHost, roomState = state) {
  const usedPersonaIds = new Set(roomState.participants.map((p) => p.persona.id));
  const persona = personas.find((item) => !usedPersonaIds.has(item.id)) || personas[0];
  return {
    id,
    isHost,
    side: chooseBalancedSide(roomState),
    persona,
    joinedAt: Date.now(),
  };
}

function chooseBalancedSide(roomState = state) {
  const proCount = roomState.participants.filter((p) => p.side === "pro").length;
  const conCount = roomState.participants.filter((p) => p.side === "con").length;
  if (proCount < conCount) return "pro";
  if (conCount < proCount) return "con";
  return Math.random() > 0.5 ? "pro" : "con";
}

function balanceSides() {
  const targetPro = Math.ceil(state.participants.length / 2);
  const pro = state.participants.filter((p) => p.side === "pro");
  const con = state.participants.filter((p) => p.side === "con");

  while (pro.length > targetPro && con.length < state.participants.length - targetPro) {
    const participant = pro.pop();
    participant.side = "con";
    con.push(participant);
  }

  while (pro.length < targetPro && con.length > state.participants.length - targetPro) {
    const participant = con.pop();
    participant.side = "pro";
    pro.push(participant);
  }
}

function requestSideSpeak(side) {
  const queue = side === "pro" ? state.proQueue : state.conQueue;
  const candidate = state.participants.find(
    (participant) =>
      participant.side === side &&
      participant.id !== state.currentSpeakerId &&
      !queue.includes(participant.id),
  );

  if (!candidate) {
    showToast("这一方暂无可排队用户");
    return;
  }

  queue.push(candidate.id);
  if (state.status === "active" && !state.currentSpeakerId && state.currentSide === side) {
    tryStartNextSpeaker();
  }
  saveAndRender();
}

function requestSpeak(userId) {
  const now = Date.now();
  const me = state.participants.find((participant) => participant.id === userId);
  if (!me) return;

  if (state.status !== "active") {
    showToast("房间开始后可以申请");
    return;
  }

  if (state.currentSpeakerId === userId) {
    showToast("正在发言中");
    return;
  }

  if (now < state.cooldownUntil) {
    showToast("申请按钮冷却中");
    return;
  }

  const queue = me.side === "pro" ? state.proQueue : state.conQueue;
  if (queue.includes(userId)) {
    showToast("已经在队列中");
    return;
  }

  queue.push(userId);
  state.cooldownUntil = now + 30_000;
  if (!state.currentSpeakerId && state.currentSide === me.side) {
    tryStartNextSpeaker();
  }
  saveAndRender();
}

function tryStartNextSpeaker() {
  if (state.status !== "active" || state.currentSpeakerId) return;
  const queue = state.currentSide === "pro" ? state.proQueue : state.conQueue;
  const nextId = queue.shift();

  if (!nextId) {
    state.sideWaitingSince = state.sideWaitingSince || Date.now();
    return;
  }

  state.sideWaitingSince = null;
  state.currentSpeakerId = nextId;
  state.speakingEndsAt = Date.now() + 60_000;
}

function endSpeaking(reason) {
  if (!state.currentSpeakerId) return;
  state.currentSpeakerId = null;
  state.speakingEndsAt = null;
  state.sideWaitingSince = null;
  state.currentSide = state.currentSide === "pro" ? "con" : "pro";
  tryStartNextSpeaker();
  saveAndRender();

  if (reason === "timeout") {
    showToast("60 秒发言结束");
  }
}

function tick() {
  if (state.currentSpeakerId && state.speakingEndsAt && Date.now() >= state.speakingEndsAt) {
    endSpeaking("timeout");
    return;
  }

  if (state.status === "active" && !state.currentSpeakerId) {
    const queue = state.currentSide === "pro" ? state.proQueue : state.conQueue;
    if (queue.length > 0) {
      tryStartNextSpeaker();
      saveAndRender();
      return;
    }

    if (state.sideWaitingSince && Date.now() - state.sideWaitingSince >= 10_000) {
      state.currentSide = state.currentSide === "pro" ? "con" : "pro";
      state.sideWaitingSince = null;
      tryStartNextSpeaker();
      saveAndRender();
      return;
    }
  }

  renderTimerOnly();
}

function startTicker() {
  window.clearInterval(tickHandle);
  tickHandle = window.setInterval(tick, 250);
}

function render() {
  els.roomCode.textContent = state.roomId || "未创建";
  els.categorySelect.value = state.category;
  els.topicCategory.textContent = categoryNames[state.category];
  els.topicTitle.textContent = state.topic.title;
  els.proPosition.textContent = state.topic.pro;
  els.conPosition.textContent = state.topic.con;
  els.roomStatus.textContent = state.status === "active" ? "辩论中" : "等待中";
  els.currentSide.textContent = state.currentSide === "pro" ? "正方" : "反方";

  document.querySelectorAll("#sizeOptions button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.size) === state.maxParticipants);
  });

  renderParticipants();
  renderQueues();
  renderSpeaker();
  renderActions();
  renderTimerOnly();
}

function renderParticipants() {
  els.proList.innerHTML = "";
  els.conList.innerHTML = "";

  state.participants.forEach((participant) => {
    const card = document.createElement("article");
    card.className = `participant-card ${participant.id === state.currentSpeakerId ? "speaking" : ""}`;
    card.innerHTML = `
      <div class="mini-avatar">${participant.persona.icon}</div>
      <div>
        <strong>${participant.persona.name}${participant.id === "you" ? "（你）" : ""}</strong>
        <span>${participant.persona.voice}${participant.isHost ? " · 房主" : ""}</span>
      </div>
      <div class="badge">${participant.side === "pro" ? "正方" : "反方"}</div>
    `;

    if (participant.side === "pro") {
      els.proList.appendChild(card);
    } else {
      els.conList.appendChild(card);
    }
  });
}

function renderQueues() {
  els.proQueue.textContent = formatQueue(state.proQueue);
  els.conQueue.textContent = formatQueue(state.conQueue);
}

function renderSpeaker() {
  const speaker = state.participants.find((participant) => participant.id === state.currentSpeakerId);

  if (!speaker) {
    els.speakerAvatar.textContent = "?";
    els.speakerLabel.textContent = state.status === "active" ? "等待申请发言" : "等待房主开始";
    els.speakerName.textContent = "暂无发言";
    return;
  }

  els.speakerAvatar.textContent = speaker.persona.icon;
  els.speakerLabel.textContent = speaker.side === "pro" ? "正方发言中" : "反方发言中";
  els.speakerName.textContent = `${speaker.persona.name}${speaker.id === "you" ? "（你）" : ""}`;
}

function renderActions() {
  const me = state.participants.find((participant) => participant.id === "you");
  const isSpeaking = state.currentSpeakerId === "you";
  const isQueued = state.proQueue.includes("you") || state.conQueue.includes("you");
  const cooldownLeft = Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000));

  els.startRoomButton.disabled = state.status === "active" || state.participants.length !== state.maxParticipants;
  els.startRoomButton.textContent = state.participants.length === state.maxParticipants ? "开始辩论" : "满员后开始";
  els.endSpeakButton.disabled = !isSpeaking;
  els.speakButton.disabled = state.status !== "active" || isSpeaking || isQueued || cooldownLeft > 0;

  if (state.status !== "active") {
    els.speakButton.textContent = "等待开始";
  } else if (isSpeaking) {
    els.speakButton.textContent = "正在发言";
  } else if (isQueued) {
    els.speakButton.textContent = "排队中";
  } else if (cooldownLeft > 0) {
    els.speakButton.textContent = `冷却 ${cooldownLeft}s`;
  } else if (me && me.side !== state.currentSide && !state.currentSpeakerId) {
    els.speakButton.textContent = "申请发言";
  } else {
    els.speakButton.textContent = "申请发言";
  }
}

function renderTimerOnly() {
  if (!state.currentSpeakerId || !state.speakingEndsAt) {
    els.speakerTimer.textContent = "--";
  } else {
    const seconds = Math.max(0, Math.ceil((state.speakingEndsAt - Date.now()) / 1000));
    els.speakerTimer.textContent = `${seconds}s`;
  }

  renderActions();
}

function formatQueue(queue) {
  if (!queue.length) return "空";
  return queue
    .map((id) => {
      const participant = state.participants.find((item) => item.id === id);
      return participant ? participant.persona.name : "离线";
    })
    .join("、");
}

function removeMissingQueuedUsers() {
  const ids = new Set(state.participants.map((participant) => participant.id));
  state.proQueue = state.proQueue.filter((id) => ids.has(id));
  state.conQueue = state.conQueue.filter((id) => ids.has(id));
}

function pickTopic(category) {
  const pool = topics[category] || topics.technology;
  return pool[Math.floor(Math.random() * pool.length)];
}

function saveAndRender() {
  saveState();
  render();
}

function saveState() {
  localStorage.setItem("debate-room-mvp", JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem("debate-room-mvp");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function showToast(message) {
  window.clearTimeout(toastHandle);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastHandle = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}
