"""
管理路由：模型增删改
  GET  /admin/models/      - 列出所有模型（隐藏 api_key）
  POST /admin/models/     - 添加模型
  PUT  /admin/models/{name} - 更新模型
  DELETE /admin/models/{name} - 删除模型
"""
import logging
from fastapi import APIRouter, HTTPException

from ..config import get_config, add_model, update_model, delete_model

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def _mask_key(key: str) -> str:
    """脱敏 api_key，只显示前4位和后4位"""
    if not key or len(key) <= 8:
        return "****"
    return key[:4] + "****" + key[-4:]


@router.get("/models/")
async def list_models():
    """列出所有模型（api_key 脱敏）"""
    cfg = get_config()
    return {
        "models": [
            {
                "name": m.name,
                "api_url": m.api_url,
                "api_key": _mask_key(m.api_key),
                "enabled": m.enabled,
            }
            for m in cfg.models
        ]
    }


@router.post("/models/")
async def create_model(body: dict):
    """
    添加模型。
    body: { "name": "...", "api_url": "...", "api_key": "...", "enabled": true }
    """
    name = body.get("name", "").strip()
    api_url = body.get("api_url", "").strip()
    api_key = body.get("api_key", "").strip()
    enabled = body.get("enabled", True)

    if not name:
        raise HTTPException(status_code=400, detail="name 不能为空")
    if not api_url:
        raise HTTPException(status_code=400, detail="api_url 不能为空")
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key 不能为空")

    try:
        model = add_model(name=name, api_url=api_url, api_key=api_key, enabled=enabled)
        logger.info(f"[Admin] 添加模型：{name}")
        return {"message": "模型添加成功", "name": model.name, "enabled": model.enabled}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.put("/models/{name}")
async def modify_model(name: str, body: dict):
    """
    更新模型（仅传入的字段会被更新）。
    body 可含：api_url, api_key, enabled
    """
    api_url = body.get("api_url")
    api_key = body.get("api_key")
    enabled = body.get("enabled")

    # 空字符串显式转 None（避免覆盖为空）
    if api_url == "":
        api_url = None
    if api_key == "":
        api_key = None

    try:
        model = update_model(
            name=name,
            api_url=api_url,
            api_key=api_key,
            enabled=enabled,
        )
        logger.info(f"[Admin] 更新模型：{name}")
        return {
            "message": "模型更新成功",
            "name": model.name,
            "api_key": _mask_key(model.api_key),
            "enabled": model.enabled,
        }
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/models/{name}")
async def remove_model(name: str):
    """删除指定模型"""
    try:
        delete_model(name)
        logger.info(f"[Admin] 删除模型：{name}")
        return {"message": f"模型 '{name}' 已删除"}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
