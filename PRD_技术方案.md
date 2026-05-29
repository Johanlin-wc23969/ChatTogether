# 匿名语音辩论聊天室 PRD + 技术方案

## 1. 项目概述

### 1.1 产品定位

本项目是一款匿名语音辩论聊天室。用户以随机匿名卡通身份进入 2-6 人房间，围绕系统随机生成的辩题进行正反方轮流发言。每次仅允许一名用户开麦，发言最长 60 秒，可提前结束。用户通过按钮申请进入发言队列，按钮有 30 秒冷却时间，避免频繁抢占发言机会。

产品核心不是普通语音群聊，而是一个强规则约束的轻量辩论场景：

- 匿名身份降低表达压力。
- 正反方分组制造观点碰撞。
- 单人限时发言保证秩序。
- 发言队列与冷却机制提升公平性。
- 卡通身份与变声预设增强匿名感和趣味性。

### 1.2 目标用户

- 喜欢表达观点、参与辩论的年轻用户。
- 想在低压力匿名环境中练习表达的人。
- 希望围绕社会、情感、科技、校园、职场、娱乐等主题进行轻量讨论的用户。

### 1.3 MVP 目标

第一版目标是验证核心玩法是否成立：

1. 用户能创建或加入 2-6 人匿名房间。
2. 房间自动生成辩题。
3. 用户随机获得阵营、卡通身份和变声预设。
4. 正反方轮流申请并获得发言权。
5. 同一时间只有一人可发言。
6. 发言最长 60 秒，可提前结束。
7. 申请发言按钮有 30 秒冷却。
8. 房间状态实时同步。

## 2. 核心用户流程

### 2.1 创建房间

1. 用户进入首页。
2. 点击创建房间。
3. 选择主题分类。
4. 选择人数上限：3、4、5、6。
5. 后端创建房间并随机生成辩题。
6. 房主进入房间等待其他用户。

### 2.2 加入房间

1. 用户通过房间列表、邀请码或匹配入口进入房间。
2. 后端检查房间人数是否已满。
3. 后端为用户分配：
   - 匿名卡通身份。
   - 对应变声预设。
   - 正方或反方阵营。
4. 用户进入房间页。
5. 房间内所有用户收到成员变化通知。

### 2.3 开始辩论

1. 房间人数达到最低人数 3 人后，房主可点击开始。
2. 系统进入辩论中状态。
3. 当前可发言阵营默认为正方，也可由后端随机决定。
4. 当前阵营用户可点击申请发言。
5. 后端按规则授予发言权。

### 2.4 申请发言

1. 用户点击申请发言。
2. 客户端发送申请请求到后端。
3. 后端校验：
   - 用户在房间内。
   - 房间处于辩论中。
   - 用户未处于 30 秒冷却期。
   - 用户不是当前发言者。
   - 用户阵营符合当前轮次，或进入本阵营队列等待。
4. 校验通过后进入发言队列。
5. 客户端按钮进入冷却状态。

### 2.5 发言

1. 后端从当前阵营队列中选择下一个发言者。
2. 后端广播当前发言者、发言结束时间。
3. iOS 端只允许当前发言者打开麦克风。
4. 其他用户只能收听。
5. 发言者可主动点击结束发言。
6. 到达 60 秒后，后端自动结束本轮发言。
7. 系统切换到对方阵营。

### 2.6 退出与断线

1. 用户主动退出房间，后端移除用户。
2. 如果用户是当前发言者，后端立即结束其发言并切换下一轮。
3. 如果用户在队列中，后端从队列移除。
4. 如果房主退出，可转移房主给最早加入的用户。
5. 如果房间人数低于 2 人，可进入等待状态或自动关闭。

## 3. 产品功能需求

### 3.1 首页

功能：

- 创建房间。
- 加入房间。
- 选择主题分类。
- 查看可加入房间列表，MVP 可先用邀请码或测试房间代替。

### 3.2 创建房间页

字段：

- 主题分类：
  - 社会
  - 科技
  - 情感
  - 校园
  - 职场
  - 娱乐
  - 生活方式
- 人数上限：
  - 3 人
  - 4 人
  - 5 人
  - 6 人

创建成功后：

- 后端返回房间 ID。
- 后端返回随机辩题。
- 用户进入房间页并成为房主。

### 3.3 房间页

核心展示：

- 房间辩题。
- 当前房间人数。
- 正方成员列表。
- 反方成员列表。
- 当前发言者。
- 发言倒计时。
- 发言队列。
- 用户自己的匿名身份、阵营、变声形象。

核心操作：

- 申请发言。
- 结束发言。
- 静音本地收听，非发言者不等于开麦。
- 退出房间。
- 房主开始房间。

按钮状态：

- 未开始：等待开始。
- 可申请：显示“申请发言”。
- 冷却中：显示倒计时。
- 已在队列：显示“排队中”。
- 当前发言中：显示“结束发言”。
- 非当前阵营：显示“等待对方发言结束”。

### 3.4 匿名身份与变声

每个用户进入房间时，后端随机分配匿名角色。角色由卡通形象和变声预设组成。

示例角色：

| 角色 | 形象 | 变声方向 |
| --- | --- | --- |
| 熊 | 厚重、稳重 | 低沉、慢速、厚声 |
| 狗 | 活泼、直接 | 中高音、轻快 |
| 猫 | 敏捷、冷静 | 偏高、轻柔 |
| 鸟 | 清亮、灵动 | 高音、明亮 |
| 机器人 | 理性、机械 | 电子音、轻微失真 |
| 外星人 | 奇异、幽默 | 变调、空间感 |

规则：

- 同一房间内角色不可重复。
- 用户只展示匿名角色，不展示真实昵称。
- 变声预设由后端分配，iOS 端执行。
- 后端不需要处理真实音频变声，MVP 优先使用音视频 SDK 或 iOS 端音频处理能力。

### 3.5 阵营分配

规则：

- 用户加入房间后自动随机分配正方或反方。
- 保证双方人数尽量平均。
- 奇数人数时允许一方多 1 人。
- 角色分配与阵营分配相互独立。

示例：

| 房间人数 | 正方 | 反方 |
| --- | --- | --- |
| 3 | 2 | 1 |
| 4 | 2 | 2 |
| 5 | 3 | 2 |
| 6 | 3 | 3 |

### 3.6 辩题生成

MVP 采用题库随机，不依赖大模型。

流程：

1. 房主选择主题分类。
2. 后端从对应分类题库随机选择辩题。
3. 房间创建后辩题固定。
4. 房主可在未开始前重新抽题，MVP 可选。

辩题格式：

```json
{
  "id": "topic_001",
  "category": "technology",
  "title": "AI 会让普通人的工作机会变多还是变少？",
  "proPosition": "AI 会让普通人的工作机会变多",
  "conPosition": "AI 会让普通人的工作机会变少"
}
```

### 3.7 发言队列与轮流规则

核心规则：

- 同一时间只有一个当前发言者。
- 当前发言者最多发言 60 秒。
- 用户可提前结束。
- 正反方轮流发言。
- 用户点击申请发言后进入本阵营队列。
- 每次点击申请后进入 30 秒冷却。
- 冷却由后端计算，客户端只展示倒计时。

队列建议：

- 后端维护两个队列：
  - proQueue
  - conQueue
- 当前轮到正方时，只从 proQueue 取人。
- 当前轮到反方时，只从 conQueue 取人。
- 如果当前阵营无人排队：
  - 等待 10 秒。
  - 若仍无人申请，自动跳到对方阵营。

### 3.8 房间状态

房间状态：

- waiting：等待中。
- active：辩论中。
- paused：暂停，MVP 可不做。
- ended：已结束。

状态切换：

```text
waiting -> active -> ended
```

触发条件：

- waiting -> active：房主开始，且人数不少于 3。
- active -> ended：房主结束、人数不足、系统超时。

## 4. 非功能需求

### 4.1 实时性

- 房间状态同步延迟目标小于 300 ms。
- 发言权切换延迟目标小于 500 ms。
- 语音延迟依赖音视频 SDK，目标小于 500 ms。

### 4.2 稳定性

- 后端必须能处理用户断线重连。
- 当前发言者断线时必须释放发言权。
- 客户端不可自行决定发言权，必须以后端广播为准。

### 4.3 安全与风控

- MVP 阶段至少支持举报。
- 不展示真实用户昵称、头像、手机号、Apple ID。
- 房间内只展示匿名角色。
- 后续可加入语音内容审核、敏感词题库过滤、封禁系统。

### 4.4 可扩展性

- 房间状态放 Redis，便于横向扩容。
- 长连接服务可多实例部署。
- WebSocket 节点通过 Redis Pub/Sub 或消息队列同步事件。
- 音视频服务优先使用第三方 SDK，避免早期自研媒体服务器。

## 5. 技术方案

### 5.1 推荐技术栈

```text
iOS 客户端：SwiftUI + Combine/async-await
实时状态：WebSocket
语音能力：LiveKit 或 Agora
后端服务：Go
缓存与房间状态：Redis
持久化数据库：PostgreSQL
对象存储：S3 兼容存储，用于头像资源等
后台管理：Web Admin，后期建设
```

### 5.2 为什么后端推荐 Go 而不是 C++

C++ 可以用于高性能音频算法和底层媒体处理，但不适合作为 MVP 业务后端首选。

原因：

- 业务后端主要复杂度在房间状态、队列、计时、冷却、断线恢复，不是极限 CPU 性能。
- Go 的并发模型天然适合聊天室和 WebSocket。
- Go 的开发效率、部署复杂度和团队招聘成本更适合早期产品。
- C++ 实现 Web API、WebSocket、数据库、Redis、业务状态机会显著增加工程成本。

建议架构：

```text
业务后端：Go
房间状态：Redis
实时语音：LiveKit / Agora
变声能力：优先 SDK 预设，后期可接 C++ 音频模块
```

### 5.3 高层架构

```text
iOS App
  |-- REST API：登录、创建房间、获取题库、举报
  |-- WebSocket：房间状态、队列、倒计时、发言权
  |-- Voice SDK：语音推流、订阅、变声

Go Backend
  |-- Auth Service
  |-- Room Service
  |-- Debate Topic Service
  |-- Realtime Gateway
  |-- Moderation Service

Redis
  |-- Active room state
  |-- Speaker queues
  |-- Cooldown keys
  |-- WebSocket pub/sub

PostgreSQL
  |-- Users
  |-- Rooms
  |-- Debate topics
  |-- Reports
  |-- Room history

LiveKit / Agora
  |-- Audio room
  |-- Microphone permission
  |-- Voice effect preset
```

### 5.4 后端核心数据模型

#### User

```go
type User struct {
    ID        string
    CreatedAt time.Time
    Status    string
}
```

#### Room

```go
type Room struct {
    ID                string
    HostUserID        string
    TopicCategory     string
    DebateTopicID     string
    MaxParticipants   int
    Status            string
    CurrentSide       string
    CurrentSpeakerID  *string
    SpeakingEndsAt    *time.Time
    CreatedAt         time.Time
    StartedAt         *time.Time
    EndedAt           *time.Time
}
```

#### Participant

```go
type Participant struct {
    UserID          string
    RoomID          string
    Side            string
    PersonaID       string
    IsHost          bool
    JoinedAt        time.Time
    LastRequestAt   *time.Time
    ConnectionState string
}
```

#### AnonymousPersona

```go
type AnonymousPersona struct {
    ID          string
    Name        string
    AvatarURL   string
    VoicePreset string
}
```

#### DebateTopic

```go
type DebateTopic struct {
    ID          string
    Category    string
    Title       string
    ProPosition string
    ConPosition string
    Enabled     bool
}
```

### 5.5 Redis 状态设计

```text
room:{roomId}:state
room:{roomId}:participants
room:{roomId}:pro_queue
room:{roomId}:con_queue
room:{roomId}:persona_pool
room:{roomId}:current_speaker
cooldown:{roomId}:{userId}
connection:{userId}
```

冷却：

```text
SET cooldown:{roomId}:{userId} 1 EX 30
```

发言计时：

- 后端保存 speakingEndsAt。
- 服务端定时器或延迟任务在到期后自动触发 end_speaking。
- 客户端倒计时仅用于展示。

### 5.6 WebSocket 事件设计

客户端发送：

```json
{ "type": "join_room", "roomId": "room_123" }
{ "type": "start_room", "roomId": "room_123" }
{ "type": "request_speak", "roomId": "room_123" }
{ "type": "end_speak", "roomId": "room_123" }
{ "type": "leave_room", "roomId": "room_123" }
```

服务端广播：

```json
{ "type": "room_state_updated", "payload": {} }
{ "type": "participant_joined", "payload": {} }
{ "type": "participant_left", "payload": {} }
{ "type": "speaker_started", "payload": {} }
{ "type": "speaker_ended", "payload": {} }
{ "type": "queue_updated", "payload": {} }
{ "type": "cooldown_started", "payload": { "seconds": 30 } }
{ "type": "error", "payload": { "code": "COOLDOWN_ACTIVE" } }
```

### 5.7 REST API 草案

```text
POST /auth/anonymous
POST /rooms
GET  /rooms/{roomId}
POST /rooms/{roomId}/join
POST /rooms/{roomId}/leave
GET  /topics/categories
GET  /topics/random?category=technology
POST /reports
```

创建房间请求：

```json
{
  "category": "technology",
  "maxParticipants": 4
}
```

创建房间响应：

```json
{
  "roomId": "room_123",
  "topic": {
    "title": "AI 会让普通人的工作机会变多还是变少？",
    "proPosition": "变多",
    "conPosition": "变少"
  }
}
```

## 6. 三部分开发详解

## 6.1 iOS 客户端开发

### 6.1.1 技术选择

```text
语言：Swift
UI：SwiftUI
状态管理：ObservableObject / Swift Concurrency
网络：URLSession
WebSocket：URLSessionWebSocketTask 或 Starscream
音视频：LiveKit iOS SDK 或 Agora iOS SDK
本地存储：Keychain + UserDefaults
```

### 6.1.2 页面模块

#### 首页

功能：

- 展示创建房间入口。
- 展示加入房间入口。
- 展示主题分类。

组件：

- CategorySelector
- CreateRoomButton
- JoinRoomInput

#### 创建房间页

功能：

- 选择主题分类。
- 选择人数上限。
- 创建房间。

组件：

- TopicCategoryGrid
- RoomSizeSegmentedControl
- CreateRoomForm

#### 房间页

功能：

- 展示辩题。
- 展示正反方成员。
- 展示匿名角色。
- 展示当前发言者。
- 展示倒计时。
- 控制申请发言、结束发言。

组件：

- DebateTopicHeader
- SidePanel
- ParticipantAvatar
- SpeakerTimer
- SpeakActionButton
- QueueView
- RoomStatusBar

### 6.1.3 客户端状态模型

```swift
struct RoomState: Codable {
    let roomId: String
    let status: RoomStatus
    let topic: DebateTopic
    let participants: [Participant]
    let currentSide: DebateSide
    let currentSpeakerId: String?
    let speakingEndsAt: Date?
    let proQueue: [String]
    let conQueue: [String]
}
```

```swift
struct Participant: Codable, Identifiable {
    let id: String
    let side: DebateSide
    let persona: AnonymousPersona
    let isHost: Bool
    let isConnected: Bool
}
```

### 6.1.4 语音控制逻辑

原则：

- 只有后端广播 currentSpeakerId 等于当前用户时，客户端才启用麦克风。
- 用户不是当前发言者时，即使点击系统麦克风，也应在应用层关闭本地音轨。
- 变声预设基于后端分配 persona.voicePreset。

伪代码：

```swift
func applyRoomState(_ state: RoomState) {
    let canSpeak = state.currentSpeakerId == currentUserId
    voiceService.setMicrophoneEnabled(canSpeak)

    if canSpeak {
        voiceService.applyVoicePreset(currentUser.persona.voicePreset)
    }
}
```

### 6.1.5 iOS 开发任务拆分

第一阶段：

- 搭建 SwiftUI 项目。
- 实现匿名登录。
- 实现创建房间 API。
- 实现房间页静态 UI。
- 实现 WebSocket 连接与事件解析。

第二阶段：

- 接入房间实时状态。
- 实现申请发言按钮状态。
- 实现倒计时。
- 实现正反方成员展示。
- 实现匿名角色展示。

第三阶段：

- 接入 LiveKit / Agora。
- 根据后端发言权控制麦克风。
- 接入变声预设。
- 处理断线重连。
- 完成举报和退出房间。

验收标准：

- 两台以上 iPhone 可进入同一房间。
- 用户身份匿名且角色不重复。
- 非当前发言者无法开麦。
- 当前发言者 60 秒后自动失去发言权。
- 申请发言按钮冷却 30 秒。

## 6.2 后端开发

### 6.2.1 技术选择

```text
语言：Go
Web 框架：Gin / Echo / Fiber
WebSocket：gorilla/websocket 或 nhooyr.io/websocket
数据库：PostgreSQL
缓存：Redis
ORM：sqlc / GORM / ent
部署：Docker + Kubernetes 或 Docker Compose
```

推荐优先级：

- MVP：Gin + gorilla/websocket + Redis + PostgreSQL。
- 稳定后：拆分 realtime gateway 与 room service。

### 6.2.2 后端模块

#### Auth Service

职责：

- 创建匿名用户。
- 生成访问 token。
- 维护设备与用户 ID 的关系。

#### Room Service

职责：

- 创建房间。
- 加入房间。
- 分配阵营。
- 分配匿名角色。
- 管理房间生命周期。

#### Topic Service

职责：

- 管理主题分类。
- 随机返回辩题。
- 后台导入题库。

#### Realtime Gateway

职责：

- 维护 WebSocket 连接。
- 接收客户端事件。
- 调用 Room Service 执行业务规则。
- 广播房间状态。

#### Speaking Scheduler

职责：

- 管理 60 秒发言超时。
- 管理阵营轮换。
- 当前发言者断线时释放发言权。

### 6.2.3 核心状态机

```text
Room waiting
  -> host starts
Room active
  -> user requests speak
User enters queue
  -> scheduler grants speaking
User speaking
  -> timeout or manual end
Switch side
  -> next queue
```

### 6.2.4 发言申请逻辑

伪代码：

```go
func RequestSpeak(roomID, userID string) error {
    room := LoadRoomState(roomID)

    if room.Status != "active" {
        return ErrRoomNotActive
    }

    participant := room.GetParticipant(userID)
    if participant == nil {
        return ErrNotInRoom
    }

    if IsCooldownActive(roomID, userID) {
        return ErrCooldownActive
    }

    if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
        return ErrAlreadySpeaking
    }

    queue := QueueForSide(participant.Side)
    if queue.Contains(userID) {
        return ErrAlreadyQueued
    }

    queue.Push(userID)
    SetCooldown(roomID, userID, 30*time.Second)
    BroadcastQueueUpdated(roomID)

    if room.CurrentSpeakerID == nil && room.CurrentSide == participant.Side {
        TryStartNextSpeaker(roomID)
    }

    return nil
}
```

### 6.2.5 开始下一位发言者

伪代码：

```go
func TryStartNextSpeaker(roomID string) {
    room := LoadRoomState(roomID)

    if room.CurrentSpeakerID != nil {
        return
    }

    queue := QueueForSide(room.CurrentSide)
    nextUserID := queue.PopConnectedParticipant()

    if nextUserID == "" {
        ScheduleSideSkip(roomID, 10*time.Second)
        return
    }

    endsAt := time.Now().Add(60 * time.Second)
    room.CurrentSpeakerID = &nextUserID
    room.SpeakingEndsAt = &endsAt
    SaveRoomState(room)

    ScheduleEndSpeaking(roomID, nextUserID, endsAt)
    BroadcastSpeakerStarted(roomID, nextUserID, endsAt)
}
```

### 6.2.6 结束发言

伪代码：

```go
func EndSpeaking(roomID, userID string, reason string) error {
    room := LoadRoomState(roomID)

    if room.CurrentSpeakerID == nil {
        return nil
    }

    if *room.CurrentSpeakerID != userID && reason == "manual" {
        return ErrNotCurrentSpeaker
    }

    room.CurrentSpeakerID = nil
    room.SpeakingEndsAt = nil
    room.CurrentSide = OppositeSide(room.CurrentSide)
    SaveRoomState(room)

    BroadcastSpeakerEnded(roomID, userID, reason)
    TryStartNextSpeaker(roomID)

    return nil
}
```

### 6.2.7 后端开发任务拆分

第一阶段：

- 搭建 Go 服务。
- 实现匿名用户接口。
- 设计 PostgreSQL 表结构。
- 实现题库和随机辩题接口。
- 实现创建房间、加入房间。

第二阶段：

- 接入 Redis 房间状态。
- 实现阵营分配。
- 实现匿名角色分配。
- 实现 WebSocket 连接。
- 实现房间状态广播。

第三阶段：

- 实现发言队列。
- 实现 30 秒冷却。
- 实现 60 秒发言计时。
- 实现正反方轮换。
- 实现断线重连处理。
- 实现基础举报接口。

验收标准：

- 创建房间后能生成辩题。
- 同一房间角色不重复。
- 正反方分配尽量平均。
- 多用户同时申请发言时队列顺序稳定。
- 冷却由后端强制执行。
- 用户断线时不阻塞房间发言流程。

## 6.3 实时语音与变声开发

### 6.3.1 推荐方案

MVP 优先使用第三方实时音频 SDK：

- LiveKit：开源、自托管能力强、适合后期可控架构。
- Agora：商业化成熟、移动端能力稳定、变声和音效能力较完整。

如果目标是最快验证产品，优先 Agora。

如果目标是长期掌控基础设施，优先 LiveKit。

### 6.3.2 音频房间设计

每个辩论房间对应一个音频房间：

```text
App Room ID: room_123
Voice Room ID: voice_room_123
```

加入流程：

1. iOS 请求加入业务房间。
2. 后端校验成功。
3. 后端签发音视频 SDK token。
4. iOS 用 token 加入音频房间。
5. 默认关闭本地麦克风。
6. 只有获得发言权时开启麦克风。

### 6.3.3 麦克风权限控制

必须双层控制：

- 客户端控制：非当前发言者关闭本地音轨。
- 服务端控制：通过 SDK 权限或房间规则限制发布音频。

理想状态：

- 后端签发 token 时区分 publish 权限。
- 当前发言者获得 publish 权限。
- 非当前发言者只有 subscribe 权限。

如果 SDK 动态权限切换复杂，MVP 可先采用客户端关闭麦克风，但后续必须补服务端权限控制。

### 6.3.4 变声方案

MVP 方案：

- 后端分配 persona.voicePreset。
- iOS 根据 voicePreset 调用 SDK 的变声 API。
- 不在后端处理音频流。

示例映射：

```json
{
  "bear": {
    "pitch": -3,
    "formant": -2,
    "speed": 0.95
  },
  "dog": {
    "pitch": 2,
    "formant": 1,
    "speed": 1.05
  },
  "cat": {
    "pitch": 4,
    "formant": 2,
    "speed": 1.0
  },
  "bird": {
    "pitch": 6,
    "formant": 3,
    "speed": 1.08
  }
}
```

注意：

- 变声不能过度影响可懂度。
- 每个角色的声音差异要明显，但不能刺耳。
- 变声应在本地上行前处理，避免真实声音被直接推流。

### 6.3.5 防止真实声音泄露

建议：

- 加入房间后默认麦克风关闭。
- 用户首次发言前展示麦克风授权和变声状态。
- 当前发言者开麦前先应用变声参数。
- 变声应用成功后再启用本地音轨。
- 如果变声 SDK 初始化失败，不允许开麦，提示用户重试。

### 6.3.6 实时语音开发任务拆分

第一阶段：

- 选型 LiveKit 或 Agora。
- 搭建测试音频房间。
- iOS 加入音频房间。
- 默认只收听，不发布音频。

第二阶段：

- 根据后端 currentSpeakerId 控制麦克风。
- 当前发言者开启音轨。
- 非当前发言者关闭音轨。
- 处理用户退出和断线。

第三阶段：

- 接入变声 API。
- 建立 persona -> voicePreset 映射。
- 开麦前检查变声是否生效。
- 优化延迟、回声、噪声抑制。

验收标准：

- 同一房间内只有当前发言者能被听到。
- 当前发言者结束后麦克风立即关闭。
- 60 秒超时后麦克风自动关闭。
- 每个匿名角色有明显不同的声音效果。
- 变声失败时不会暴露原声。

## 7. 数据库表设计草案

### users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'active'
);
```

### debate_topics

```sql
CREATE TABLE debate_topics (
    id UUID PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    pro_position TEXT NOT NULL,
    con_position TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### rooms

```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    host_user_id UUID NOT NULL REFERENCES users(id),
    debate_topic_id UUID NOT NULL REFERENCES debate_topics(id),
    topic_category TEXT NOT NULL,
    max_participants INT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);
```

### room_participants

```sql
CREATE TABLE room_participants (
    room_id UUID NOT NULL REFERENCES rooms(id),
    user_id UUID NOT NULL REFERENCES users(id),
    side TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    PRIMARY KEY (room_id, user_id)
);
```

### reports

```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id),
    reporter_user_id UUID NOT NULL REFERENCES users(id),
    target_user_id UUID REFERENCES users(id),
    reason TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 8. MVP 里程碑

### Milestone 1：可进入房间

目标：

- 匿名登录。
- 创建房间。
- 加入房间。
- 随机辩题。
- 阵营和角色分配。

### Milestone 2：可实时同步

目标：

- WebSocket 连接。
- 房间状态广播。
- 用户加入、退出同步。
- 正反方成员列表同步。

### Milestone 3：可轮流发言

目标：

- 申请发言。
- 队列。
- 冷却。
- 当前发言者。
- 60 秒倒计时。
- 正反方轮换。

### Milestone 4：可真实语音

目标：

- 接入语音 SDK。
- 控制麦克风。
- 当前发言者可被听到。
- 非发言者只能收听。

### Milestone 5：匿名变声体验

目标：

- 卡通身份展示。
- 变声预设生效。
- 原声保护。
- 举报和退出流程。

## 9. 风险与建议

### 9.1 主要风险

- 语音 SDK 动态权限控制复杂。
- 变声效果可能影响可懂度。
- 匿名场景容易产生违规内容。
- 强轮流机制可能让等待时间过长。
- 奇数人数下正反方体验可能不完全平衡。

### 9.2 产品建议

- MVP 不要一开始做复杂匹配，先用创建房间和邀请码验证玩法。
- 第一版辩题用人工题库，不依赖大模型。
- 优先保证“只有一人能说话”的秩序感。
- 匿名角色要有趣，但不要幼稚化。
- 后续可以增加观众席、投票、最佳辩手、复盘卡片等玩法。

## 10. 下一步建议

建议下一步按以下顺序推进：

1. 确定语音 SDK：Agora 或 LiveKit。
2. 确定 MVP 是否需要房间列表，还是只做邀请码。
3. 输出 iOS 原型图。
4. 输出 Go 后端接口文档。
5. 建立题库初版。
6. 开始 Milestone 1 开发。
