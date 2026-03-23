"""
配置管理：加载 config.json，支持运行时增删模型（自动写回文件）
"""
import json
import logging
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.json"

# 全局锁：防止并发读写 config.json 冲突
_config_lock = threading.Lock()


@dataclass
class ModelConfig:
    """单个模型的配置"""
    name: str
    api_url: str
    api_key: str
    enabled: bool = True

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "api_url": self.api_url,
            "api_key": self.api_key,
            "enabled": self.enabled,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ModelConfig":
        return cls(
            name=d["name"],
            api_url=d["api_url"],
            api_key=d["api_key"],
            enabled=d.get("enabled", True),
        )


@dataclass
class AppConfig:
    """全局配置"""
    timeout: float
    max_concurrent: int
    max_history: int
    models: list[ModelConfig] = field(default_factory=list)

    def get_model(self, name: str) -> Optional[ModelConfig]:
        for m in self.models:
            if m.name == name and m.enabled:
                return m
        return None

    def get_first_enabled_model(self) -> Optional[ModelConfig]:
        for m in self.models:
            if m.enabled:
                return m
        return None


# ---------------------------------------------------------------------------
# 内部读写
# ---------------------------------------------------------------------------

def _load_raw() -> dict:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(
            f"配置文件不存在：{CONFIG_PATH}\n"
            f"请复制 config.example.json 为 config.json 并填入模型配置"
        )
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_raw(data: dict) -> None:
    with _config_lock:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)


# ---------------------------------------------------------------------------
# 全局配置单例（懒加载，进程内只读一次）
# ---------------------------------------------------------------------------

_cfg: Optional[AppConfig] = None


def get_config() -> AppConfig:
    global _cfg
    if _cfg is None:
        _cfg = _build_config(_load_raw())
    return _cfg


def reload_config() -> AppConfig:
    """强制重新加载（用于 admin 操作后刷新）"""
    global _cfg
    _cfg = _build_config(_load_raw())
    return _cfg


def _build_config(raw: dict) -> AppConfig:
    models = [ModelConfig.from_dict(m) for m in raw.get("models", [])]

    # 校验至少有一个启用的模型
    if not any(m.enabled for m in models):
        raise ValueError("config.json 中没有启用的模型，请至少保留一个 enabled=true 的模型")

    return AppConfig(
        timeout=raw.get("timeout", 60.0),
        max_concurrent=raw.get("max_concurrent", 3),
        max_history=raw.get("max_history", 20),
        models=models,
    )


# ---------------------------------------------------------------------------
# 模型增删改（会写回 config.json）
# ---------------------------------------------------------------------------

def add_model(name: str, api_url: str, api_key: str, enabled: bool = True) -> ModelConfig:
    """添加一个新模型，如果已存在则覆盖"""
    cfg = get_config()

    # 检查 name 是否重复
    existing = next((m for m in cfg.models if m.name == name), None)
    if existing:
        raise ValueError(f"模型 '{name}' 已存在，请使用 PUT /admin/models/{{name}} 更新")

    new_model = ModelConfig(name=name, api_url=api_url, api_key=api_key, enabled=enabled)
    cfg.models.append(new_model)

    _write_models(cfg.models)

    logger.info(f"[配置] 添加模型成功：{name}，enabled={enabled}")
    return new_model


def update_model(name: str, api_url: str = None, api_key: str = None,
                 enabled: bool = None) -> ModelConfig:
    """更新指定模型配置"""
    cfg = get_config()
    model = cfg.get_model(name) or next((m for m in cfg.models if m.name == name), None)
    if model is None:
        raise KeyError(f"模型 '{name}' 不存在")

    if api_url is not None:
        model.api_url = api_url
    if api_key is not None:
        model.api_key = api_key
    if enabled is not None:
        model.enabled = enabled

    _write_models(cfg.models)

    logger.info(f"[配置] 更新模型成功：{name}")
    return model


def delete_model(name: str) -> None:
    """删除指定模型"""
    cfg = get_config()
    original_count = len(cfg.models)
    cfg.models = [m for m in cfg.models if m.name != name]

    if len(cfg.models) == original_count:
        raise KeyError(f"模型 '{name}' 不存在")

    if not any(m.enabled for m in cfg.models):
        raise ValueError("删除后没有启用的模型了，请至少保留一个 enabled=true 的模型")

    _write_models(cfg.models)
    logger.info(f"[配置] 删除模型：{name}")


def _write_models(models: list[ModelConfig]) -> None:
    """将模型列表写回 config.json（保留其他字段）"""
    raw = _load_raw()
    raw["models"] = [m.to_dict() for m in models]
    _save_raw(raw)
    reload_config()
