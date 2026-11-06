import asyncio
import contextlib
import os
from collections.abc import Callable, Coroutine
from typing import Any

from gateway.config import Platform, PlatformConfig  # type: ignore[import-not-found]
from gateway.platforms.base import BasePlatformAdapter, SendResult  # type: ignore[import-not-found]
from gateway.platforms.event import MessageEvent, MessageType  # type: ignore[import-not-found]

from zapbip_platform.connection_link import socket_link_of
from zapbip_platform.connector_socket import run_connector_socket
from zapbip_platform.constants import CONNECTION_LINK_ENV, OWNER_CHAT_ID, OWNER_CHAT_TYPE, PLATFORM_NAME
from zapbip_platform.handoff import handoff_text_of, message_timestamp_of
from zapbip_platform.mcp_outbound import McpOutboundError, send_owner_text

OWNER_ONLY_MESSAGE = "zapbip delivers only to the owner chat"


def connection_link_from_environment() -> str:
    connection_link = os.environ.get(CONNECTION_LINK_ENV)
    if not connection_link:
        raise ValueError(f"{CONNECTION_LINK_ENV} is required")
    return connection_link


class ZapbipAdapter(BasePlatformAdapter):  # type: ignore[misc]
    def __init__(
        self,
        config: PlatformConfig,
        *,
        run_socket: Callable[..., Coroutine[Any, Any, int]] = run_connector_socket,
        send_text: Callable[..., Coroutine[Any, Any, None]] = send_owner_text,
    ) -> None:
        super().__init__(config=config, platform=Platform(PLATFORM_NAME))
        self._connection_link = connection_link_from_environment()
        self._socket_link = socket_link_of(connection_link=self._connection_link)
        self._run_socket = run_socket
        self._send_text = send_text
        self._stop = asyncio.Event()
        self._socket_task: asyncio.Task[int] | None = None

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        if self._socket_task is not None and not self._socket_task.done():
            return True
        self._stop = asyncio.Event()
        self._socket_task = asyncio.create_task(
            self._run_socket(socket_link=self._socket_link, stop=self._stop, hand_off=self._hand_off)
        )
        self._socket_task.add_done_callback(lambda finished: self._mark_disconnected())
        self._mark_connected()
        return True

    async def disconnect(self) -> None:
        self._stop.set()
        socket_task = self._socket_task
        self._socket_task = None
        self._mark_disconnected()
        if socket_task is None:
            return
        with contextlib.suppress(asyncio.CancelledError):
            await socket_task

    async def send(
        self, chat_id: str, content: str, reply_to: str | None = None, metadata: dict[str, Any] | None = None
    ) -> Any:
        if chat_id != OWNER_CHAT_ID:
            return SendResult(success=False, error=OWNER_ONLY_MESSAGE)
        try:
            await self._send_text(mcp_link=self._connection_link, text=content)
        except McpOutboundError as error:
            return SendResult(success=False, error=str(error))
        return SendResult(success=True)

    async def get_chat_info(self, chat_id: str) -> dict[str, str]:
        return {"name": OWNER_CHAT_ID, "type": OWNER_CHAT_TYPE}

    async def _hand_off(self, *, message: dict[str, Any]) -> None:
        source = self.build_source(
            chat_id=OWNER_CHAT_ID,
            chat_name=OWNER_CHAT_ID,
            chat_type=OWNER_CHAT_TYPE,
            user_id=OWNER_CHAT_ID,
            user_name=OWNER_CHAT_ID,
            message_id=message["messageId"],
        )
        event = MessageEvent(
            text=handoff_text_of(message=message),
            message_type=MessageType.TEXT,
            source=source,
            message_id=message["messageId"],
            raw_message=message,
            timestamp=message_timestamp_of(message=message),
        )
        await self.handle_message(event)
