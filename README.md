<div align="center">

<h1>🔥🎭 Anonymous Debate Room · 匿名辩论室 💬⚡</h1>

### 戴上最萌的面具，开最猛的火。来一场不看脸的灵魂对决。

<p>
  <img src="https://img.shields.io/badge/status-MVP%20Playable-43ff93?style=for-the-badge&labelColor=17142f" alt="Project Status" />
  <img src="https://img.shields.io/badge/license-MIT-ffd25a?style=for-the-badge&labelColor=17142f" alt="License" />
  <img src="https://img.shields.io/github/stars/your-name/anonymous-debate-room?style=for-the-badge&logo=github&color=8b5cf6&labelColor=17142f" alt="GitHub Stars" />
  <img src="https://img.shields.io/github/contributors/your-name/anonymous-debate-room?style=for-the-badge&color=22d3ee&labelColor=17142f" alt="Contributors" />
  <img src="https://img.shields.io/badge/React%20%2B%20Go%20%2B%20WebRTC-Neon%20Stack-ff6da9?style=for-the-badge&logo=react&logoColor=white&labelColor=17142f" alt="Tech Stack" />
  <a href="https://chat-together-phi.vercel.app">
    <img src="https://img.shields.io/badge/Live%20Demo-Enter%20Lobby-43ff93?style=for-the-badge&logo=vercel&logoColor=white&labelColor=17142f" alt="Live Demo" />
  </a>
</p>

> 🎬 **Preview Placeholder**
>
> 此处放置 Lobby & Debate Room 的炫酷 GIF 动图或卡片设计图。
>
> 推荐文件路径：`docs/assets/anonymous-debate-room-preview.gif`

<br />

</div>

## 🧨 What Is This?

**Anonymous Debate Room** 是一个卡通、生动、游戏化的匿名语音辩论房。

它不是冷冰冰的会议软件。它更像一间混合了 **Among Us 的匿名身份感**、**鹅鸭杀的社交混乱感**、以及 **Duolingo 式可爱压力感** 的线上辩论竞技场。

在这里：

- 你不会暴露昵称。
- 你会被随机分配匿名动物头像。
- 你会被随机分到正方或反方。
- 你只能排队发言。
- 每次发言最多 60 秒。
- 房间里只有一个麦克风能燃烧。

> [!TIP]
> 这不是一个“谁嗓门大谁赢”的房间。这里靠排队、倒计时、阵营轮换和一点点戏剧张力活着。

---

## 🕹️ Core Scenes

### 🌆 Debate Lobby · 辩论大厅

进入大厅，就像走进一个霓虹闪烁的赛博辩论游乐场：

- 🧊 **3D 粘土风看板**：今日房间像游戏副本一样排开。
- 🐻 **匿名动物头像预览**：还没进房，就能看到里面坐着几只神秘生物。
- 💫 **霓虹话题卡片**：每个房间都是一张待引爆的观点炸弹。
- 🟢 **实时房间状态**：等待中、辩论中、在线人数一眼可见。
- 🚪 **一键加入**：看中哪个火药桶，点进去开吵。

```text
┌─────────────────────────────────────────┐
│  ROOM LOBBY                             │
│  今日热场：选个阵营，用头像开麦           │
│                                         │
│  [科技] AI 会让工作机会变多吗？  🐻🐶 +1 │
│  [情感] 恋爱中坦白一切真的必要吗？ 🐱🛸  │
└─────────────────────────────────────────┘
```

### 💣 Debate Room · 答辩房

房间开始后，所有人进入正反阵营对垒：

- 🔴 **正方 vs 反方**：左右阵营卡片像游戏队伍面板。
- 🎙️ **唯一发言麦克风**：同一时间只有一人发言。
- 💣 **炸弹倒计时**：60 秒，讲完你的观点，否则时间爆炸。
- 🌀 **发言队列**：申请发言后进入队列，防止抢麦。
- 🟢 **音量波动可视化**：发言者头像周围会有语音能量反馈。
- 👑 **房主解散机制**：辩论开始后普通参与者不可中途退出，房主可解散房间。

> [!IMPORTANT]
> 辩论开始后，普通参与者不能中途逃跑。观点已经上桌，麦克风已经点燃。

---

## ⚔️ Team Red vs Team Blue

<table>
  <tr>
    <td align="center" width="50%">
      <h3>🟢 正方阵营 · Team For</h3>
      <p><strong>“香菜是灵魂调味。”</strong></p>
      <img src="https://placehold.co/420x240/1f7a5f/ffffff?text=Team+For+Avatars" alt="Team For Placeholder" />
      <br />
      <sub>发言者头像发光，队列头像向上浮动。</sub>
    </td>
    <td align="center" width="50%">
      <h3>🔴 反方阵营 · Team Against</h3>
      <p><strong>“香菜是味觉袭击。”</strong></p>
      <img src="https://placehold.co/420x240/b64954/ffffff?text=Team+Against+Avatars" alt="Team Against Placeholder" />
      <br />
      <sub>反方蓄势待发，随时准备接麦开火。</sub>
    </td>
  </tr>
</table>

---

<details>
<summary><strong>🧩 核心机制拆解 · 点击展开这台辩论机器的齿轮</strong></summary>

### 🎭 匿名身份

- 用户进入房间后随机获得动物头像。
- 当前没有昵称系统。
- 房间内只展示头像，不展示真实身份。

### 🏟️ 房间规则

- 支持 2-6 人房间。
- 房主创建房间并设置主题分类。
- 后端从对应分类随机抽取辩题。
- 房间满员后，房主才能开始辩论。

### ⚖️ 阵营分配

- 开始辩论后，系统自动平均分配正反双方。
- 等待阶段不提前展示阵营，避免预判和站队。

### 🎙️ 发言规则

- 同一时间只有一名参与者发言。
- 发言最长 60 秒。
- 发言者可以提前结束发言。
- 申请发言后进入己方队列。
- 申请发言有 30 秒冷却时间。
- 正反双方轮流获得优先发言权。

### 📡 实时同步

- WebSocket 广播房间状态。
- 支持断线离线态。
- 离线头像变灰并显示“离线”。
- 离线超过 30 秒自动踢出房间。

</details>

---

## ✅ Features

| 状态 | Feature | 描述 |
| --- | --- | --- |
| 🟢 `[x]` | Game Lobby | 游戏大厅式房间列表，展示房间状态、人数和匿名头像预览 |
| 🟢 `[x]` | Create Room Modal | 弹窗创建房间，支持主题分类和 2-6 人设置 |
| 🟢 `[x]` | Anonymous Personas | 随机匿名动物头像，无昵称系统 |
| 🟢 `[x]` | Debate Topic Pool | 多分类随机辩题，情感类题库更大 |
| 🟢 `[x]` | Waiting Room | 等待房间、空位槽、房主和自己身份标识 |
| 🟢 `[x]` | Auto Team Assignment | 开始后自动平均分配正反方 |
| 🟢 `[x]` | Speaking Queue | 正反方排队发言，头像动态展示 |
| 🟢 `[x]` | 60s Timer | 单次发言最多 60 秒 |
| 🟢 `[x]` | 30s Cooldown | 申请发言冷却，防止抢麦刷屏 |
| 🟢 `[x]` | WebRTC Voice | 浏览器语音通话基础能力 |
| 🟢 `[x]` | Voice Visualizer | 发言中音量波动可视化 |
| 🟢 `[x]` | Offline State | 断线头像变灰，30 秒后自动移除 |
| 🟢 `[x]` | Host Dissolve Room | 辩论开始后仅房主可解散房间 |
| 🟡 `[ ]` | Persistent Storage | 房间状态持久化到 Redis / PostgreSQL |
| 🟡 `[ ]` | Moderation Tools | 举报、踢人、内容安全和风控 |
| 🟡 `[ ]` | Better Voice Masking | 更强匿名变声方案 |
| 🔴 `[ ]` | Production TURN | 更稳定公网 WebRTC 中继 |

---

## 🧰 Tech Stack

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=06172a" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Go-Backend-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/WebSocket-Realtime-8b5cf6?style=for-the-badge" alt="WebSocket" />
  <img src="https://img.shields.io/badge/WebRTC-Voice-43ff93?style=for-the-badge&logo=webrtc&logoColor=06172a" alt="WebRTC" />
  <img src="https://img.shields.io/badge/Lucide-Icons-fd4d4d?style=for-the-badge&logo=lucide&logoColor=white" alt="Lucide" />
</p>

### Architecture

```text
anonymous-debate-room/
├── debate-room-web/       # React + TypeScript + Vite frontend
├── debate-room-server/    # Go + net/http + gorilla/websocket backend
├── DEPLOYMENT.md          # deployment notes
├── PRD_技术方案.md        # product and technical plan
└── README.md              # you are here
```

---

## 🚀 Quick Start

> [!NOTE]
> 推荐同时启动后端和前端。语音能力在公网环境下通常需要 HTTPS，复杂网络下建议配置 TURN。

```bash
# 🚀 1. Clone the neon debate arena
git clone https://github.com/your-name/anonymous-debate-room.git
cd anonymous-debate-room

# 🛠️ 2. Start the Go realtime server
cd debate-room-server
go mod tidy
go run .

# 服务默认运行在:
# http://localhost:8080
```

```bash
# 📦 3. Open another terminal and boot the web client
cd debate-room-web
npm install
npm run dev

# 前端默认运行在:
# http://localhost:5173
```

```bash
# ✅ 4. Quality checks
cd debate-room-web
npm run lint
npm run build

cd ../debate-room-server
go test ./...
```

---

## 🔌 API Snapshot

```http
GET  /health
GET  /api/rooms
POST /api/rooms
POST /api/rooms/:roomId/join
GET  /ws?roomId=:roomId&userId=:userId
```

### WebSocket Client Events

```json
{ "type": "start_room" }
{ "type": "request_speak" }
{ "type": "end_speak" }
{ "type": "leave_room" }
{ "type": "voice_signal", "data": { "target": "user-id", "signalType": "offer", "payload": {} } }
```

---

## 🧪 Current MVP Boundary

这个项目目前是早期可玩 MVP，适合本地联调和小范围内测。

> [!WARNING]
> 当前后端使用单实例内存状态。服务重启后房间会清空。生产环境建议引入 Redis / PostgreSQL。

> [!CAUTION]
> Web Audio 变声只能提供轻量娱乐效果，不能保证完全无法识别性别或身份。强匿名语音需要更专业的音频处理方案。

---

## 🗺️ Roadmap

- 🟢 完成大厅、等待页、发言页核心闭环
- 🟢 完成 WebSocket 房间同步
- 🟢 完成 WebRTC 语音基础能力
- 🟢 完成移动端布局适配
- 🟡 接入 Redis 做房间状态持久化
- 🟡 增加 TURN 服务提升公网语音稳定性
- 🟡 增加观众互动特效：扔西红柿、疯狂鼓掌、撒花
- 🟡 增加辩论结束结算页
- 🔴 增加举报、封禁、内容审核和基础风控

---

## 🤝 Contributing

欢迎加入这间混乱但可爱的匿名辩论大厅。

```bash
# 🍅 Fork this repo
# 👻 Create your feature branch
git checkout -b feat/flying-tomatoes

# 🎨 Commit your chaos
git commit -m "feat: add tomato throwing effect"

# 🚀 Push and open a PR
git push origin feat/flying-tomatoes
```

### Contributors

<p align="center">
  <a href="https://github.com/your-name/anonymous-debate-room/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=your-name/anonymous-debate-room" alt="Contributors" />
  </a>
</p>

<p align="center">
  <sub>贡献者头像墙，就像辩论大厅的观众席。坐稳，麦克风要来了。</sub>
</p>

---

## 📜 License

MIT License.

如果你用它做了一个更吵、更萌、更炸裂的匿名辩论产品，记得回来给个 Star。

<div align="center">

### 🎭 Anonymous Debate Room

**Speak freely. Listen openly. Leave no face behind.**

</div>
