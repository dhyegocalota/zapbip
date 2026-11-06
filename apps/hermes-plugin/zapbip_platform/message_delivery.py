import asyncio
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import Any

from zapbip_platform.constants import SEEN_MESSAGE_LIMIT, PluginLogEvent
from zapbip_platform.log import log_connector_event

Message = dict[str, Any]


class MessageDelivery:
    def __init__(
        self,
        *,
        hand_off: Callable[..., Awaitable[None]],
        send_done: Callable[..., Awaitable[None]],
    ) -> None:
        self._hand_off = hand_off
        self._send_done = send_done
        self._queue: asyncio.Queue[Message] = asyncio.Queue()
        self._pending: set[str] = set()
        self._seen: OrderedDict[str, None] = OrderedDict()

    def enqueue(self, *, messages: list[Message]) -> None:
        for message in messages:
            self._accept(message=message)

    async def run(self) -> None:
        while True:
            await self._deliver(message=await self._queue.get())

    def _accept(self, *, message: Message) -> None:
        message_id = message["messageId"]
        if message_id in self._pending:
            return
        if message_id not in self._seen:
            self._pending.add(message_id)
        self._queue.put_nowait(message)

    def _remember(self, *, message_id: str) -> None:
        self._seen[message_id] = None
        if len(self._seen) > SEEN_MESSAGE_LIMIT:
            self._seen.popitem(last=False)

    async def _deliver(self, *, message: Message) -> None:
        message_id = message["messageId"]
        if message_id in self._seen:
            await self._send_done(message_id=message_id)
            return
        try:
            await self._hand_off(message=message)
        except Exception as error:
            self._pending.discard(message_id)
            log_connector_event(
                event=PluginLogEvent.HANDOFF_FAILED, messageId=message_id, error=type(error).__name__
            )
            return
        self._pending.discard(message_id)
        self._remember(message_id=message_id)
        await self._send_done(message_id=message_id)
