# DeepSeek Service

基于 DeepSeek API 的 FastAPI 异步聊天服务。

## 环境准备

```bash
pip install -r requirements.txt
```

## 配置 API Key

**方式一：环境变量（推荐）**
```bash
# Linux/macOS
export DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# Windows PowerShell
$env:DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"
```

**方式二：直接修改代码**（不推荐，key 会泄露到版本历史）
编辑 `deepseek_api.py`，找到 `AI_API` 那行填入你的 key。

## 启动服务

```bash
python deepseek_api.py
```

服务默认运行在 `http://localhost:8000`

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 服务信息 |
| `/health` | GET | 健康检查 |
| `/chat/` | POST | 聊天（Header 传 `X-Session-ID` 保持上下文）|
| `/chat/reset/` | POST | 重置会话历史 |

## 示例请求

```bash
# 启动新会话聊天
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{"content": "你好"}'

# 传入 session_id 继续对话
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: <上一步返回的session_id>" \
  -d '{"content": "继续上一个问题"}'

# 健康检查
curl http://localhost:8000/health
```

## 测试脚本

```bash
# 同步测试（单次请求）
python test_deepseek.py
python test_deepseek2.py
```

## 配置参数

在 `deepseek_api.py` 的配置区可以调整：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MODEL` | `deepseek-chat` | 模型名称 |
| `MAX_RETRIES` | `3` | 最大重试次数 |
| `TIMEOUT` | `60.0` | HTTP 超时（秒）|
| `MAX_CONCURRENT` | `3` | 最大并发数 |
| `MAX_HISTORY` | `20` | 每会话保留消息数 |
