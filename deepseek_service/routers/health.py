"""健康检查路由：GET /health"""
from fastapi import APIRouter

from ..config import get_config
from ..session import SessionManager
from ..api_client import APIClient

router = APIRouter(tags=["system"])


def init_health(sm: SessionManager, api_client: APIClient):
    global _sm, _api
    _sm = api_client  # unused but kept for future
    _api = api_client


_sm = None
_api = None


@router.get("/health")
async def health():
    cfg = get_config()
    return {
        "status": "healthy",
        "timeout": cfg.timeout,
        "max_concurrent": cfg.max_concurrent,
        "max_history": cfg.max_history,
        "models": [m.name for m in cfg.models if m.enabled],
        "active_sessions": len(_sm._store._store) if _sm else 0,
        "current_requests": _api.current_requests if _api else 0,
    }


@router.get("/")
async def root():
    return {
        "message": "DeepSeek Service（多模型版）",
        "docs": "/docs",
        "endpoints": {
            "POST /chat/": "聊天（Header: X-Session-ID, X-Model）",
            "POST /chat/reset/": "重置会话历史",
            "GET  /health": "健康检查",
            "GET  /admin/models/": "列出所有模型",
            "POST /admin/models/": "添加模型",
            "PUT  /admin/models/{name}": "更新模型",
            "DELETE /admin/models/{name}": "删除模型",
        },
    }
