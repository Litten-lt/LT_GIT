# Gobang Online - 五子棋在线对战

## 1. 概述

### 1.1 目标
在现有五子棋网页游戏基础上，新增在线对战功能，支持两名玩家通过房间码进行实时对战。

### 1.2 技术方案
- **后端**: Node.js + Socket.IO 单服务器
- **存储**: 内存存储（不持久化）
- **部署**: 本地运行

### 1.3 系统架构
```
┌─────────────────────────────────────────────────────────┐
│                    Node.js Server                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Socket.IO   │  │ Room Manager│  │ Game State      │  │
│  │ (WebSocket) │  │ (Map结构)   │  │ (Validator)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↑                              ↑
    玩家1 Socket                  玩家2 Socket
    (浏览器)                       (浏览器)
```

---

## 2. 功能清单

### 2.1 核心功能
| 功能 | 状态 |
|------|------|
| 创建房间 | 待开发 |
| 通过房间码加入房间 | 待开发 |
| 两人实时对战 | 待开发 |
| 回合制交替落子 | 待开发 |
| 胜负判定同步 | 待开发 |
| 平局判定同步 | 待开发 |
| 游戏结束后可重新开始 | 待开发 |

### 2.2 不在范围内
- 断线重连
- 房间持久化
- 历史对局记录
- 匹配队列
- 观战功能
- 积分/ELO系统

---

## 3. 房间系统

### 3.1 房间码生成
- 6位字母数字组合（如: `ABC123`）
- 唯一性检查，确保不重复

### 3.2 房间状态
| 状态 | 说明 |
|------|------|
| `waiting` | 等待玩家加入 |
| `playing` | 游戏中 |
| `ended` | 游戏结束 |

### 3.3 房间容量
- 每房间最多 2 名玩家
- 可选支持观战者（暂不实现）

---

## 4. Socket 通信协议

### 4.1 客户端 → 服务器事件

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `create-room` | `{}` | 创建新房间 |
| `join-room` | `{ roomId: string }` | 加入房间 |
| `leave-room` | `{ roomId: string }` | 离开房间 |
| `make-move` | `{ roomId: string, row: number, col: number }` | 落子 |
| `restart-game` | `{ roomId: string }` | 请求重新开始 |

### 4.2 服务器 → 客户端事件

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `room-created` | `{ roomId: string }` | 房间创建成功 |
| `room-joined` | `{ room: Room, playerIndex: 0\|1 }` | 加入房间成功 |
| `player-joined` | `{ room: Room }` | 其他玩家加入 |
| `opponent-move` | `{ row: number, col: number, player: 'black'\|'white' }` | 对手落子 |
| `game-over` | `{ winner: 'black'\|'white'\|'draw', winningLine?: [number,number][] }` | 游戏结束 |
| `restart-approved` | `{ room: Room }` | 对方同意重新开始 |
| `restart-denied` | `{}` | 对方拒绝重新开始 |
| `opponent-left` | `{}` | 对手离开 |
| `error` | `{ message: string }` | 错误信息 |
| `room-state` | `{ room: Room }` | 当前房间状态（同步） |

---

## 5. 数据结构

### 5.1 Room 接口
```typescript
interface Room {
  id: string;           // 6位房间码
  players: [string | null, string | null];  // [黑方, 白方]
  state: 'waiting' | 'playing' | 'ended';
  board: Board;         // 15x15
  currentPlayer: 'black' | 'white';
  moveHistory: [number, number][];
  winner: Player | 'draw' | null;
  winningLine: [number, number][] | null;
  createdAt: number;
  blackSocketId: string | null;
  whiteSocketId: string | null;
}
```

### 5.2 玩家索引
- `playerIndex: 0` = 黑方（先手）
- `playerIndex: 1` = 白方（后手）

---

## 6. 游戏流程

### 6.1 创建房间
```
1. 玩家点击"创建房间"
2. 服务器生成6位房间码
3. 服务器返回 roomId
4. 玩家进入等待界面
5. 另一位玩家加入后开始游戏
```

### 6.2 加入房间
```
1. 玩家输入房间码
2. 服务器验证房间存在且未满
3. 玩家作为白方加入
4. 游戏开始
```

### 6.3 游戏进行
```
1. 黑方先行
2. 落子后验证合法性
3. 服务器广播落子给双方
4. 判断胜负或平局
5. 超时未落子判负（暂不实现）
```

### 6.4 重新开始
```
1. 任意一方可请求重新开始
2. 对方同意后双方重置棋盘
3. 拒绝则保持结束状态
```

---

## 7. 错误处理

| 错误情况 | 服务器响应 |
|----------|------------|
| 房间不存在 | `{ error: 'room-not-found' }` |
| 房间已满 | `{ error: 'room-full' }` |
| 非玩家操作 | `{ error: 'not-your-turn' }` |
| 位置已有棋子 | `{ error: 'cell-occupied' }` |
| 游戏已结束 | `{ error: 'game-ended' }` |

---

## 8. 目录结构

```
gobang-web/
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # 服务器入口
│       ├── types.ts           # 共享类型
│       ├── RoomManager.ts     # 房间管理
│       ├── GameEngine.ts      # 游戏逻辑验证
│       └── handlers.ts        # Socket事件处理
├── docs/
│   ├── README.md              # 主文档
│   └── ONLINE_SPEC.md         # 在线对战详细规格
└── src/
    ├── hooks/
    │   └── useOnlineGame.ts   # 在线游戏hook
    ├── components/
    │   ├── RoomUI.tsx         # 房间界面
    │   └── OnlineStatus.tsx   # 连接状态
    └── App.tsx                # 集成在线模式
```

---

## 9. 服务器环境

### 9.1 依赖
- Node.js 18+
- socket.io
- express (可选)

### 9.2 启动命令
```bash
cd server
npm install
npm run dev  # 开发模式
npm start   # 生产模式
```

### 9.3 客户端连接
- 开发环境: `http://localhost:3001`
- 生产环境: 部署后服务器地址

---

## 10. 安全考虑

### 10.1 服务端验证
- 所有客户端落子必须经过服务端验证
- 禁止非法位置落子
- 禁止在非己方回合落子

### 10.2 限制
- 单IP连接数限制（防滥用）
- 房间超时自动清理（30分钟无活动）

---

*文档版本: v1.0.0*
*创建日期: 2026-05-08*