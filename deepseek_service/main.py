"""
DeepSeek Service 入口
多模型 · 异步并发 · 会话锁 · 模块化
"""
import sys
import logging
import uvicorn
from pathlib import Path

# 将当前目录加入 path，确保可以 `python main.py` 运行
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI

from config import get_config, reload_config
from session import SessionManager
from api_client import APIClient
from routers.chat import init_chat, router as chat_router
from routers.admin import router as admin_router
from routers.health import init_health, router as health_router


# ---------------------------------------------------------------------------
# 日志
# ---------------------------------------------------------------------------

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )
    file_handler = logging.FileHandler("app.log", encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )
    logging.getLogger().addHandler(file_handler)


# ---------------------------------------------------------------------------
# FastAPI 实例
# ---------------------------------------------------------------------------

app = FastAPI(title="DeepSeek Service", version="2.0.0")

# 加载配置
cfg = reload_config()  # 启动时校验配置有效性

# 初始化组件
session_mgr = SessionManager.from_config(max_history=cfg.max_history, backend="memory")
api_client = APIClient()

# 注入依赖
init_chat(session_mgr, api_client)
init_health(session_mgr, api_client)

# 注册路由
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(health_router)


# ---------------------------------------------------------------------------
# 启动日志
# ---------------------------------------------------------------------------

setup_logging()
logger = logging.getLogger(__name__)
enabled_models = [m.name for m in cfg.models if m.enabled]
logger.info("=" * 55)
logger.info("DeepSeek Service 启动（多模型版）")
logger.info(f"并发上限={cfg.max_concurrent} | 历史上限={cfg.max_history}")
logger.info(f"已启用模型：{enabled_models}")
logger.info("=" * 55)


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
