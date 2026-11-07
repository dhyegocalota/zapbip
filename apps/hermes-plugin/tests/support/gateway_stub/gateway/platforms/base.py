from dataclasses import dataclass
from typing import Any

from gateway.config import Platform, PlatformConfig
from gateway.platforms.event import MessageEvent, SessionSource


@dataclass
class SendResult:
    success: bool
    message_id: str | None = None
    error: str | None = None


class BasePlatformAdapter:
    def __init__(self, config: PlatformConfig, platform: Platform) -> None:
        self.config = config
        self.platform = platform
        self._running = False
        self.handled_events: list[MessageEvent] = []
        self.handle_message_error: Exception | None = None

    def _mark_connected(self) -> None:
        self._running = True

    def _mark_disconnected(self) -> None:
        self._running = False

    def build_source(
        self,
        chat_id: str,
        chat_name: str | None = None,
        chat_type: str = "dm",
        user_id: str | None = None,
        user_name: str | None = None,
        message_id: str | None = None,
    ) -> SessionSource:
        return SessionSource(
            platform=self.platform,
            chat_id=chat_id,
            chat_name=chat_name,
            chat_type=chat_type,
            user_id=user_id,
            user_name=user_name,
            message_id=message_id,
        )

    async def handle_message(self, event: MessageEvent) -> None:
        if self.handle_message_error is not None:
            raise self.handle_message_error
        self.handled_events.append(event)

    async def get_chat_info(self, chat_id: str) -> dict[str, Any]:
        raise NotImplementedError
