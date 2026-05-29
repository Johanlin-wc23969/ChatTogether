# 匿名辩论房 Web

这是匿名语音辩论聊天室的正式前端工程。当前阶段已接入本地 Go 后端，通过 REST 创建/加入房间，通过 WebSocket 同步房间状态。

## 技术栈

- Vite
- React
- TypeScript
- lucide-react

## 启动

```bash
npm install
npm run dev
```

默认地址：

```text
http://localhost:5173/
```

环境变量见：

```text
.env.example
```

需要同时启动后端：

```bash
cd ../debate-room-server
go run .
```

公网部署说明见项目根目录：

```text
../DEPLOYMENT.md
```

## 当前已实现

- 创建房间
- 主题分类选择
- 3-6 人房间上限
- 加入测试用户
- 匿名角色与变声标签
- 正反方自动分配
- 正反方排队
- 当前发言者展示
- 60 秒发言倒计时
- 30 秒申请冷却
- 无人排队时自动换边
- WebSocket 房间状态同步
- 邀请链接自动加入房间

## 目录结构

```text
src/
  app/          应用入口和远端状态适配
  components/   页面组件
  domain/       房间规则、类型、题库和角色
  styles/       全局样式
```

## 下一步

1. 增加真实多人加入和退出房间细节。
2. 部署公网内测。
3. 接入 Agora 或 LiveKit 实时语音。
4. 接入匿名角色对应的变声能力。
5. 增加举报和内容安全能力。
