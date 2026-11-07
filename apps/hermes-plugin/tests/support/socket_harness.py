import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

from fake_connector import FakeConnector
from zapbip_platform.connector_socket import ConnectorTiming, run_connector_socket

RUN_TIMEOUT_SECONDS = 10.0
FAST_TIMING = ConnectorTiming(
    heartbeat_interval_ms=25_000, heartbeat_timeout_ms=10_000, reconnect_base_ms=5, reconnect_max_ms=20
)


class HandedOff:
    def __init__(self, *, connector: FakeConnector) -> None:
        self.message_ids: list[str] = []
        self.failing_ids: set[str] = set()
        self.gates: dict[str, asyncio.Event] = {}
        self.sent_dones_at_start: dict[str, list[str]] = {}
        self._connector = connector

    async def hand_off(self, *, message: dict[str, Any]) -> None:
        message_id = str(message["messageId"])
        self.message_ids.append(message_id)
        self._connector.record(entry=f"handoff:{message_id}")
        self.sent_dones_at_start[message_id] = [
            line for line in self._connector.logs if '"event": "done_sent"' in line
        ]
        gate = self.gates.get(message_id)
        if gate is not None:
            await gate.wait()
        if message_id in self.failing_ids:
            self.failing_ids.discard(message_id)
            raise RuntimeError("the agent refused the message")


class RunningSocket:
    def __init__(self, *, task: "asyncio.Task[int]", stop: asyncio.Event) -> None:
        self.task = task
        self.stop = stop

    async def finish(self) -> int:
        self.stop.set()
        async with asyncio.timeout(RUN_TIMEOUT_SECONDS):
            return await self.task


def fail_on_error(*, connector: FakeConnector, finished: "asyncio.Task[int]") -> None:
    if finished.cancelled():
        return
    error = finished.exception()
    if error is not None:
        connector.fail(error=error)


@asynccontextmanager
async def running_socket(
    *, connector: FakeConnector, hand_off: Callable[..., Awaitable[None]], **options: Any
) -> AsyncIterator[RunningSocket]:
    stop = asyncio.Event()
    timing = options.pop("timing", FAST_TIMING)
    task = asyncio.create_task(
        run_connector_socket(
            socket_link=connector.socket_link, stop=stop, hand_off=hand_off, timing=timing, **options
        )
    )
    task.add_done_callback(lambda finished: fail_on_error(connector=connector, finished=finished))
    running = RunningSocket(task=task, stop=stop)
    try:
        yield running
    finally:
        if not task.done():
            await running.finish()
