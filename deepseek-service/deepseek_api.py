"""
DeepSeek FastAPI 服务 - 完整版
功能列表：
  1. 日志系统 - 记录所有请求/响应/错误到控制台+文件
  2. 异步非阻塞 - httpx.AsyncClient + async/await，API 慢时不卡服务
  3. 并发控制 - Semaphore 限制同时最多 N 个请求
  4. 上下文记忆 - session_id 维持多轮对话上下文
  5. 自动重试 - 超时/失败自动重试最多 3 次
  6. 健康检查 - /health 查看服务状态和并发数

用法：
  POST /chat/         - 聊天（Header 传 X-Session-ID 保持上下文）
  GET  /health         - 健康检查
  POST /chat/reset/    - 重置会话历史
  GET  /              - 服务信息
"""

import os
from fastapi import FastAPI, Request
from pydantic import BaseModel
import httpx
import logging
import sys
import time
import asyncio
import uuid
from datetime import datetime
from collections import defaultdict

app = FastAPI()

class Message(BaseModel):
    content: str

# ========== 配置区 ==========
AI_URL = "https://api.deepseek.com/v1/chat/completions"
AI_API = os.getenv("DEEPSEEK_API_KEY", "")
MODEL = "deepseek-chat"
MAX_RETRIES = 3          # 最大重试次数
TIMEOUT = 60.0           # HTTP 请求超时（秒）
MAX_CONCURRENT = 3        # 最大同时并发请求数
MAX_HISTORY = 20          # 每个会话最多保留多少条历史消息
# ============================


# ============================================================
# 1. 日志系统
# ============================================================

logger = logging.getLogger(__name__)

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout
    )
    file_handler = logging.FileHandler("app.log", encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(logging.Formatter(
        "[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(file_handler)

setup_logging()

logger.info("=" * 55)
logger.info("DeepSeek FastAPI 服务启动")
logger.info(f"模型={MODEL} | 并发上限={MAX_CONCURRENT} | 历史上限={MAX_HISTORY}")
logger.info("=" * 55)


# ============================================================
# 2. 并发控制 - Semaphore
# ============================================================

semaphore = asyncio.Semaphore(MAX_CONCURRENT)
current_requests = 0


# ============================================================
# 3. 上下文记忆 - defaultdict
# ============================================================

session_histories: dict = defaultdict(list)


# ============================================================
# 核心：异步 API 调用
# ============================================================

async def call_ai_api(session_id: str, user_input: str) -> str:
    global current_requests

    if not AI_API:
        return "Error: DEEPSEEK_API_KEY environment variable not set"

    headers = {
        "Authorization": f"Bearer {AI_API}",
        "Content-Type": "application/json"
    }

    history = session_histories[session_id]
    messages = list(history)
    messages.append({"role": "user", "content": user_input})

    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False
    }

    logger.info(f"[请求] sid={session_id[:8]} hist={len(history)//2}轮 输入={len(user_input)}字")

    for attempt in range(MAX_RETRIES):
        try:
            async with semaphore:
                current_requests += 1
                logger.info(f"[限流] 进入 {current_requests}/{MAX_CONCURRENT}")

                try:
                    start_time = time.time()
                    async with httpx.AsyncClient(timeout=httpx.Timeout(TIMEOUT)) as client:
                        response = await client.post(AI_URL, headers=headers, json=payload)
                    elapsed = time.time() - start_time
                finally:
                    current_requests -= 1
                    logger.info(f"[限流] 退出 {current_requests}/{MAX_CONCURRENT}")

                if response.status_code == 200:
                    data = response.json()
                    if "choices" in data and data["choices"]:
                        reply = data["choices"][0]["message"]["content"]
                        session_histories[session_id].append({"role": "user", "content": user_input})
                        session_histories[session_id].append({"role": "assistant", "content": reply})

                        if len(session_histories[session_id]) > MAX_HISTORY:
                            half = len(session_histories[session_id]) // 2
                            session_histories[session_id] = session_histories[session_id][half:]
                            logger.info(f"[裁剪] 历史超过{MAX_HISTORY}条，保留最新{half}条")

                        logger.info(f"[成功] {elapsed:.1f}s 回复{len(reply)}字 hist={len(session_histories[session_id])}条")
                        return reply
                    else:
                        logger.warning(f"[警告] 响应格式异常: {str(data)[:80]}")
                        return str(data)
                else:
                    logger.warning(f"[API错误] HTTP {response.status_code}")
                    return f"API Error: {response.status_code}"

        except asyncio.CancelledError:
            logger.warning("[取消] 请求被中断")
            raise
        except httpx.TimeoutException:
            logger.warning(f"[超时] 第{attempt+1}次 ({TIMEOUT}s)")
            if attempt < MAX_RETRIES - 1:
                continue
            return f"Timeout after {MAX_RETRIES} retries"
        except httpx.ConnectError as e:
            logger.error(f"[连接错误] {e}")
            if attempt < MAX_RETRIES - 1:
                continue
            return f"Connection failed: {str(e)[:50]}"
        except Exception as e:
            logger.exception(f"[异常] {e}")
            if attempt < MAX_RETRIES - 1:
                continue
            return f"Failed: {str(e)[:50]}"

    return "Failed after max retries"


# ============================================================
# API 端点
# ============================================================

@app.post("/chat/")
async def chat(request: Request, message: Message):
    session_id = request.headers.get("X-Session-ID")
    is_new = False

    if not session_id:
        session_id = str(uuid.uuid4())
        is_new = True
        logger.info(f"[新会话] sid={session_id[:8]}")

    reply = await call_ai_api(session_id, message.content)

    return {
        "response": reply,
        "session_id": session_id,
        "is_new_session": is_new
    }

@app.post("/chat/reset/")
async def reset_chat(request: Request):
    data = await request.json()
    sid = data.get("session_id")
    if sid and sid in session_histories:
        count = len(session_histories[sid])
        del session_histories[sid]
        logger.info(f"[重置] sid={sid[:8]} 清除{count}条历史")
        return {"message": "历史已清除", "session_id": sid}
    return {"message": "会话不存在"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model": MODEL,
        "concurrent": current_requests,
        "max_concurrent": MAX_CONCURRENT,
        "active_sessions": len(session_histories),
        "timeout": TIMEOUT,
        "retries": MAX_RETRIES
    }

@app.get("/")
async def root():
    return {
        "message": "DeepSeek FastAPI 完整版",
        "model": MODEL,
        "endpoints": {
            "POST /chat/": "聊天（Header: X-Session-ID 保持上下文）",
            "POST /chat/reset/": "重置会话历史",
            "GET /health": "健康检查",
            "GET /": "本信息页"
        }
    }


# ============================================================
# 启动
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
