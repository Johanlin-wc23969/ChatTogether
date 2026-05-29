# 下一阶段开发路线

当前版本是本地交互原型，已经验证了核心房间节奏：

- 创建房间
- 主题与人数选择
- 匿名角色
- 正反方分配
- 发言队列
- 60 秒发言
- 30 秒冷却
- 轮流发言

下一步目标是把它推进成可以发链接给朋友测试的 Web MVP。

## 阶段 1：前端工程化

目标：把当前 HTML/CSS/JS 原型迁移为可维护的前端项目。

推荐技术栈：

```text
Vite + React + TypeScript + CSS Modules 或 Tailwind
```

任务：

1. 创建 Vite React 项目。
2. 拆分页面组件：
   - HomePage
   - CreateRoomPanel
   - DebateRoomPage
   - TopicBoard
   - ParticipantList
   - SpeakerStage
   - QueuePanel
   - SpeakButton
3. 把当前本地状态迁移为 typed state。
4. 把房间规则从 UI 文件中拆到 domain 层。
5. 保留本地模拟模式，方便无后端调试。

验收：

- 页面视觉与当前原型一致或更好。
- 本地模拟玩法完整可用。
- 所有核心状态有 TypeScript 类型。

## 阶段 2：Go 后端基础服务

目标：建立真实房间服务，但先不接语音。

任务：

1. 创建 Go API 项目。
2. 实现匿名 session。
3. 实现创建房间。
4. 实现通过 roomId 加入房间。
5. 实现主题题库随机选择。
6. 实现匿名角色分配。
7. 实现正反方分配。
8. 用内存状态先跑通 MVP，后续再换 Redis。

API 草案：

```text
POST /api/sessions
POST /api/rooms
GET  /api/rooms/:roomId
POST /api/rooms/:roomId/join
```

验收：

- 多个浏览器窗口可以加入同一房间。
- 每个用户拿到不同匿名角色。
- 正反方尽量平均。
- 创建房间后有固定辩题。

## 阶段 3：WebSocket 房间状态

目标：实现真正多人同步。

任务：

1. 建立 WebSocket 连接。
2. 用户加入房间后订阅 room state。
3. 广播成员加入、退出。
4. 实现 request_speak。
5. 实现 end_speak。
6. 实现 60 秒发言倒计时。
7. 实现 30 秒冷却。
8. 实现正反方轮换。
9. 处理刷新页面和断线重连。

WebSocket 事件：

```text
room_state
participant_joined
participant_left
speaker_started
speaker_ended
queue_updated
cooldown_started
error
```

验收：

- 3-6 个浏览器窗口能看到同一房间状态。
- 一个人申请发言，所有人同步看到队列变化。
- 当前发言者切换后，所有人同步更新。
- 超时和提前结束都由后端控制。

## 阶段 4：部署内测版

目标：朋友可以通过公网链接加入测试。

推荐：

```text
前端：Vercel
后端：Fly.io / Render / Railway
```

MVP 可以先不用 PostgreSQL 和 Redis，使用单实例内存状态。

注意：

- 单实例内存状态重启会丢房间。
- 只适合早期朋友内测。
- 一旦开放更多用户，需要 Redis + PostgreSQL。

验收：

- 可以创建公网房间链接。
- 朋友打开链接可加入。
- 多人同步稳定。

## 阶段 5：接入实时语音

目标：让当前发言者真的可以说话，其他人收听。

推荐优先级：

```text
最快验证：Agora
长期可控：LiveKit
```

任务：

1. 创建语音房间 token 接口。
2. 前端加入语音房间。
3. 默认关闭麦克风。
4. 后端授予当前发言者发言权。
5. 前端根据 currentSpeakerId 开关麦克风。
6. 接入角色对应变声预设。
7. 变声失败时禁止开麦。

验收：

- 同一时间只有当前发言者能被听到。
- 发言结束后麦克风关闭。
- 60 秒超时后自动关闭。
- 匿名角色有对应音色。

## 推荐立即执行顺序

最推荐下一步：

```text
先迁移到 Vite + React + TypeScript
```

原因：

- 当前原型逻辑已经够用，但继续堆原生 JS 会变乱。
- 后续接 WebSocket 和语音，需要组件化和类型约束。
- React 版本完成后，后端可以并行开发。

如果想最快朋友内测：

```text
直接做 Go 后端 + WebSocket
```

但这会让当前前端继续承载更多状态，后续重构成本会更高。

## 建议的第一个正式开发任务

创建正式前端工程，并迁移当前原型：

```text
debate-room-web/
  src/
    app/
    components/
    domain/
    mock/
    styles/
```

迁移完成后，再接：

```text
debate-room-server/
```

这样项目边界会比较清晰。
