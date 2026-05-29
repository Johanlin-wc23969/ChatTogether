# 匿名辩论房后端

这是 Web MVP 的第一版 Go 后端，当前使用单实例内存状态，适合本地联调和早期内测。

## 技术栈

- Go
- net/http
- gorilla/websocket

## 启动

```bash
go mod tidy
go run .
```

默认地址：

```text
http://localhost:8080
```

环境变量见：

```text
.env.example
```

公网部署说明见项目根目录：

```text
../DEPLOYMENT.md
```

## 已实现

- 创建房间
- 加入房间
- 加入测试用户
- 随机辩题
- 匿名角色分配
- 正反方自动平衡
- WebSocket 房间状态广播
- 开始辩论
- 申请发言
- 正反方测试排队
- 60 秒发言倒计时
- 30 秒用户冷却
- 当前阵营无人排队时自动换边

## API

```text
GET  /health
POST /api/rooms
POST /api/rooms/:roomId/join
POST /api/rooms/:roomId/mock
GET  /ws?roomId=:roomId&userId=:userId
```

## WebSocket 客户端事件

```json
{ "type": "start_room" }
{ "type": "request_speak" }
{ "type": "request_side", "data": { "side": "pro" } }
{ "type": "end_speak" }
```

## WebSocket 服务端事件

```json
{ "type": "room_state", "data": {} }
```

## 后续

1. 把内存状态迁移到 Redis。
2. 把房间和题库持久化到 PostgreSQL。
3. 增加用户断线、重连和退出房间处理。
4. 接入语音 SDK token 签发。
5. 增加举报和基础审核接口。
