"""
AI API 调用封装：
  - 支持任意模型（DeepSeek / OpenAI 兼容 / 文心 等）
  - 自动重试（超时 / 连接错误 / 5xx）
  - Semaphore 并发控制
  - 异常情况返回结构化错误信息
"""
import logging
import time
import httpx
import asyncio
from typing import Optional

from .config import get_config, ModelConfig

logger = logging.getLogger(__name__)


class APIClient:
    """AI API 调用客户端"""

    def __init__(self):
        cfg = get_config()
        self.timeout: float = cfg.timeout
        self.max_retries: int = 3          # 注：重试次数目前硬编码，后续可提到 config
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._current_requests: int = 0

    @property
    def semaphore(self) -> asyncio.Semaphore:
        """延迟初始化 semaphore（确保在事件循环内创建）"""
        if self._semaphore is None:
            cfg = get_config()
            self._semaphore = asyncio.Semaphore(cfg.max_concurrent)
        return self._semaphore

    async def chat(
        self,
        model_config: ModelConfig,
        messages: list[dict],
    ) -> str:
        """
        调用 AI API，返回 reply 文本。
        出错时返回结构化错误字符串，不抛异常。
        """
        headers = {
            "Authorization": f"Bearer {model_config.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model_config.name,
            "messages": messages,
            "stream": False,
        }

        for attempt in range(self.max_retries):
            try:
                async with self.semaphore:
                    self._current_requests += 1
                    logger.info(
                        f"[限流] 进入 {self._current_requests}/"
                        f"{get_config().max_concurrent} "
                        f"(model={model_config.name})"
                    )
                    try:
                        start_time = time.time()
                        async with httpx.AsyncClient(
                            timeout=httpx.Timeout(self.timeout)
                        ) as client:
                            response = await client.post(
                                model_config.api_url,
                                headers=headers,
                                json=payload,
                            )
                        elapsed = time.time() - start_time
                    finally:
                        self._current_requests -= 1

                    if response.status_code == 200:
                        data = response.json()
                        if choices := data.get("choices"):
                            reply = choices[0]["message"]["content"]
                            logger.info(
                                f"[成功] {model_config.name} {elapsed:.1f}s "
                                f"回复{len(reply)}字"
                            )
                            return reply
                        logger.warning(f"[警告] 响应缺少 choices: {str(data)[:80]}")
                        return f"[响应格式异常] {str(data)[:100]}"
                    else:
                        logger.warning(
                            f"[API错误] {model_config.name} "
                            f"HTTP {response.status_code}: {response.text[:100]}"
                        )
                        return f"[API错误] HTTP {response.status_code}"

            except asyncio.CancelledError:
                logger.warning("[取消] 请求被中断")
                raise

            except httpx.TimeoutException:
                logger.warning(
                    f"[超时] {model_config.name} 第{attempt+1}次 "
                    f"({self.timeout}s)"
                )
                if attempt < self.max_retries - 1:
                    continue
                return f"[超时] 已重试{self.max_retries}次仍失败"

            except httpx.ConnectError as e:
                logger.error(f"[连接错误] {model_config.name}: {e}")
                if attempt < self.max_retries - 1:
                    continue
                return f"[连接失败] {str(e)[:80]}"

            except Exception as e:
                logger.exception(f"[异常] {model_config.name}: {e}")
                if attempt < self.max_retries - 1:
                    continue
                return f"[异常] {str(e)[:80]}"

        return "[失败] 超过最大重试次数"

    @property
    def current_requests(self) -> int:
        return self._current_requests
