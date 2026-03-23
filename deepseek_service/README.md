# DeepSeek Service（多模型版）

基于 DeepSeek API 的 FastAPI 异步聊天服务，支持多模型切换、会话锁、模块化结构。

## 项目结构

```
deepseek_service/
├── __init__.py
├── config.py          # 配置加载 + 运行时模型增删（写 config.json）
├── session.py         # 会话管理 + asyncio.Lock 加锁 + Redis 接口预留
├── api_client.py      # AI API 调用（自动重试 + 并发控制）
├── routers/
│   ├── chat.py        # /chat/  聊天 + 重置会话
│   ├── admin.py       # /admin/models/ 模型增删改
│   └── health.py      # /health + / 服务信息
├── main.py            # FastAPI 入口
├── config.json        # 运行时配置（勿提交）
├── config.example.json # 配置模板
└── requirements.txt
```

## 环境准备

```bash
cd deepseek_service
copy config.example.json config.json
# 编辑 config.json，填入至少一个模型的 api_key
pip install -r requirements.txt
```

## 启动

```bash
python main.py
```

服务默认运行在 `http://localhost:8000`，API 文档 `http://localhost:8000/docs`

## API 端点

### 聊天

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chat/` | POST | 聊天 |
| `/chat/reset/` | POST | 重置会话历史 |

**Header 参数：**

| Header | 必填 | 说明 |
|--------|------|------|
| `X-Session-ID` | 否 | 维持多轮对话，不传则自动生成新会话 |
| `X-Model` | 否 | 指定模型名称，不传则使用第一个启用的模型 |

**请求体：**
```json
{ "content": "你好" }
```

**响应：**
```json
{
  "response": "回复内容",
  "session_id": "uuid",
  "is_new_session": true,
  "model": "deepseek-chat"
}
```

### 模型管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/models/` | GET | 列出所有模型（api_key 脱敏） |
| `/admin/models/` | POST | 添加模型 |
| `/admin/models/{name}` | PUT | 更新模型 |
| `/admin/models/{name}` | DELETE | 删除模型 |

**添加模型示例：**
```bash
curl -X POST http://localhost:8000/admin/models/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gpt-4o",
    "api_url": "https://api.openai.com/v1/chat/completions",
    "api_key": "sk-xxx",
    "enabled": true
  }'
```

**更新模型示例（只更新部分字段）：**
```bash
curl -X PUT http://localhost:8000/admin/models/deepseek-chat \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

### 系统

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/` | GET | 服务信息 |

## config.json 配置说明

```json
{
    "timeout": 60.0,
    "max_concurrent": 3,
    "max_history": 20,
    "models": [
        {
            "name": "deepseek-chat",
            "api_url": "https://api.deepseek.com/v1/chat/completions",
            "api_key": "sk-xxx",
            "enabled": true
        }
    ]
}
```

> 注意：`config.json` 不会提交到版本库（已在 `.gitignore` 中忽略）

## Redis 预留

`session.py` 中预留了 `RedisSessionStore` 接口，后续需要多实例部署时可直接实现并切换，无需改动其他代码。
