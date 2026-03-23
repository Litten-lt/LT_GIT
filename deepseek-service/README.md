# DeepSeek Service

基于 DeepSeek API 的 FastAPI 异步聊天服务。

## 环境准备

```bash
pip install -r requirements.txt
```

## 配置

**1. 复制配置文件**
```bash
copy config.example.json config.json
```

**2. 编辑 `config.json`**，填入你的 API Key：
```json
{
    "api_key": "sk-xxxxxxxxxxxxxxxx",
    "api_url": "https://api.deepseek.com/v1/chat/completions",
    "model": "deepseek-chat",
    "max_retries": 3,
    "timeout": 60.0,
    "max_concurrent": 3,
    "max_history": 20
}
```

> 注意：`config.json` 不要提交到版本控制（已加入 `.gitignore`）

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

## 配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `api_key` | **必填** | DeepSeek API Key |
| `api_url` | DeepSeek 默认地址 | API 端点 |
| `model` | `deepseek-chat` | 模型名称 |
| `max_retries` | `3` | 最大重试次数 |
| `timeout` | `60.0` | HTTP 超时（秒）|
| `max_concurrent` | `3` | 最大并发数 |
| `max_history` | `20` | 每会话保留消息数 |
