"""
聊天路由：POST /chat/
  - Header: X-Session-ID 维持多轮对话上下文
  - Header: X-Model（可选）指定模型，默认取第一个启用的模型
"""
import uuid
import logging
from fastapi import APIRouter, Request, Header, HTTPException

from ..config import get_config
from ..session import SessionManager
from ..api_client import APIClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="", tags=["chat"])

# 全局单例（启动时初始化）
_session_mgr: SessionManager = None
_api_client: APIClient = None


def init_chat(sm: SessionManager, api_client: APIClient):
    global _session_mgr, _api_client
    _session_mgr = sm
    _api_client = api_client


@router.post("/chat/")
async def chat(
    request: Request,
    x_session_id: str = Header(None),
    x_model: str = Header(None),
):
    body = await request.json()
    user_input: str = body.get("content", "")

    if not user_input:
        raise HTTPException(status_code=400, detail="content 不能为空")

    # 解析 session_id
    session_id = x_session_id or str(uuid.uuid4())
    is_new = x_session_id is None
    if is_new:
        logger.info(f"[新会话] sid={session_id[:8]}")

    # 解析模型
    cfg = get_config()
    if x_model:
        model_cfg = cfg.get_model(x_model)
        if model_cfg is None:
            raise HTTPException(status_code=400, detail=f"模型 '{x_model}' 不存在或未启用")
    else:
        model_cfg = cfg.get_first_enabled_model()
        if model_cfg is None:
            raise HTTPException(status_code=500, detail="没有可用的模型")

    # 获取历史 + 上锁（防止同一会话并发导致回复乱序）
    async with _session_mgr.lock(session_id):
        history = await _session_mgr.get_history(session_id)
        messages = list(history)
        messages.append({"role": "user", "content": user_input})

        reply = await _api_client.chat(model_cfg, messages)

        # 保存本次对话
        await _session_mgr.append(session_id, "user", user_input)
        await _session_mgr.append(session_id, "assistant", reply)

        # 裁剪超长历史
        await _session_mgr.trim(session_id, cfg.max_history)

    return {
        "response": reply,
        "session_id": session_id,
        "is_new_session": is_new,
        "model": model_cfg.name,
    }


@router.post("/chat/reset/")
async def reset_chat(request: Request):
    body = await request.json()
    sid = body.get("session_id")
    if not sid:
        raise HTTPException(status_code=400, detail="session_id 不能为空")

    await _session_mgr.clear(sid)
    return {"message": "历史已清除", "session_id": sid}
