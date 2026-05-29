# 部署说明

当前项目分成两个服务：

```text
debate-room-web      前端，Vite + React
debate-room-server   后端，Go + WebSocket
```

## 1. 后端环境变量

后端支持：

```text
PORT
ALLOWED_ORIGINS
```

本地默认：

```text
PORT=8080
ALLOWED_ORIGINS=http://localhost:5173
```

部署到公网后，`ALLOWED_ORIGINS` 应该填前端域名，例如：

```text
ALLOWED_ORIGINS=https://your-app.vercel.app
```

多个域名用英文逗号分隔：

```text
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173
```

## 2. 前端环境变量

前端支持：

```text
VITE_API_BASE_URL
VITE_WS_BASE_URL
```

本地默认：

```text
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

部署到公网后，填后端公网地址，例如：

```text
VITE_API_BASE_URL=https://your-api.onrender.com
VITE_WS_BASE_URL=wss://your-api.onrender.com
```

注意 WebSocket 公网必须用 `wss://`，不是 `ws://`。

## 3. 推荐部署顺序

### 第一步：部署后端

可选平台：

- Render
- Railway
- Fly.io

Render 示例：

1. 新建 Web Service。
2. 选择 `debate-room-server` 目录作为服务目录。
3. Build Command：

```bash
go build -o app .
```

4. Start Command：

```bash
./app
```

5. 设置环境变量：

```text
ALLOWED_ORIGINS=https://你的前端域名
```

第一次部署时前端域名还没有，可以先临时填：

```text
ALLOWED_ORIGINS=*
```

等前端部署完成后，再改成具体前端域名。

### 第二步：部署前端

推荐 Vercel：

1. 新建项目。
2. 选择 `debate-room-web` 目录。
3. Framework 选择 Vite。
4. 设置环境变量：

```text
VITE_API_BASE_URL=https://你的后端域名
VITE_WS_BASE_URL=wss://你的后端域名
```

5. 部署完成后，复制前端域名。
6. 回到后端平台，把 `ALLOWED_ORIGINS` 改成前端域名。

## 4. 本地运行

后端：

```bash
cd debate-room-server
go run .
```

前端：

```bash
cd debate-room-web
npm install
npm run dev
```

本地访问：

```text
http://localhost:5173
```

## 5. 当前限制

当前后端使用单实例内存状态：

- 服务重启后房间会丢失。
- 多实例部署时房间状态不会共享。
- 适合早期朋友内测。

后续正式化需要：

- Redis 存房间状态和队列。
- PostgreSQL 存题库、用户和房间历史。
 - 语音 SDK token 服务。
