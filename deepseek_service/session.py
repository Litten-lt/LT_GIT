"""
会话管理：
  - 按 session_id 加锁，防止同一用户并发请求导致回复乱序
  - 预留 RedisSessionStore 接口，后续可切换为 Redis 存储
"""
import asyncio
import logging
from collections import defaultdict
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 会话存储接口（抽象基类）
# ---------------------------------------------------------------------------

class SessionStore(ABC):
    """会话存储抽象接口"""

    @abstractmethod
    async def get_history(self, session_id: str) -> list[dict]:
        """获取会话历史消息列表"""
        pass

    @abstractmethod
    async def append(self, session_id: str, role: str, content: str) -> None:
        """追加一条消息到会话历史"""
        pass

    @abstractmethod
    async def trim(self, session_id: str, keep_count: int) -> None:
        """裁剪会话历史，保留最近 keep_count 条"""
        pass

    @abstractmethod
    async def clear(self, session_id: str) -> None:
        """清除指定会话的全部历史"""
        pass


# ---------------------------------------------------------------------------
# 内存实现（默认）
# ---------------------------------------------------------------------------

class MemorySessionStore(SessionStore):
    """基于进程内存的会话存储（单进程安全）"""

    def __init__(self, max_history: int):
        self.max_history = max_history
        self._store: dict[str, list[dict]] = defaultdict(list)
        # asyncio.Lock：按 session_id 分组锁，防止同一会话并发请求导致回复乱序
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def _lock(self, session_id: str) -> asyncio.Lock:
        return self._locks[session_id]

    async def get_history(self, session_id: str) -> list[dict]:
        return list(self._store[session_id])

    async def append(self, session_id: str, role: str, content: str) -> None:
        self._store[session_id].append({"role": role, "content": content})

    async def trim(self, session_id: str, keep_count: int) -> None:
        history = self._store[session_id]
        if len(history) > keep_count:
            half = len(history) // 2
            self._store[session_id] = history[half:]
            logger.info(f"[裁剪] hist={len(history)}→{len(self._store[session_id])}")

    async def clear(self, session_id: str) -> None:
        count = len(self._store.get(session_id, []))
        if session_id in self._store:
            del self._store[session_id]
        logger.info(f"[会话] sid={session_id[:8]} 清除{count}条历史")


# ---------------------------------------------------------------------------
# Redis 预留接口（暂未实现）
# ---------------------------------------------------------------------------

class RedisSessionStore(SessionStore):
    """
    基于 Redis 的会话存储（预留实现接口）。
    切换方式：创建实例时传入 redis client 即可。

    使用前需安装依赖：pip install redis
    """
    # TODO: 实现 Redis 版本，需要安装 redis-py 并启动 Redis 服务
    _NOT_IMPLEMENTED = NotImplementedError(
        "RedisSessionStore 暂未实现，如有需要请反馈"
    )

    def __init__(self, redis_client=None, max_history: int = 20, key_prefix: str = "ds:session:"):
        self._client = redis_client
        self.max_history = max_history
        self.key_prefix = key_prefix

    async def get_history(self, session_id: str) -> list[dict]:
        raise self._NOT_IMPLEMENTED

    async def append(self, session_id: str, role: str, content: str) -> None:
        raise self._NOT_IMPLEMENTED

    async def trim(self, session_id: str, keep_count: int) -> None:
        raise self._NOT_IMPLEMENTED

    async def clear(self, session_id: str) -> None:
        raise self._NOT_IMPLEMENTED


# ---------------------------------------------------------------------------
# 全局会话管理器
# ---------------------------------------------------------------------------

class SessionManager:
    """
    会话管理器（门面类）：
      - 对外暴露简单的 get/append/trim/clear 接口
      - 内部根据配置决定使用哪种存储后端
      - 每个 session_id 分配独立锁
    """

    def __init__(self, store: SessionStore):
        self._store = store

    @classmethod
    def from_config(cls, max_history: int, backend: str = "memory") -> "SessionManager":
        if backend == "memory":
            store = MemorySessionStore(max_history=max_history)
        elif backend == "redis":
            # TODO: 传入 redis client 实例
            raise NotImplementedError("Redis 后端请先实现 RedisSessionStore 并传入 client")
        else:
            raise ValueError(f"未知的 session backend: {backend}")
        return cls(store=store)

    async def get_history(self, session_id: str) -> list[dict]:
        return await self._store.get_history(session_id)

    async def append(self, session_id: str, role: str, content: str) -> None:
        await self._store.append(session_id, role, content)

    async def trim(self, session_id: str, max_history: int) -> None:
        await self._store.trim(session_id, max_history)

    async def clear(self, session_id: str) -> None:
        await self._store.clear(session_id)

    def lock(self, session_id: str) -> asyncio.Lock:
        """获取指定 session_id 的锁（由调用方在 async with 中使用）"""
        return self._store._lock(session_id)
