import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from zapbip_platform.constants import (
    HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_TIMEOUT_MS,
    RECONNECT_BASE_MS,
    RECONNECT_MAX_MS,
)


@dataclass(frozen=True)
class ConnectorTiming:
    heartbeat_interval_ms: int
    heartbeat_timeout_ms: int
    reconnect_base_ms: int
    reconnect_max_ms: int


DEFAULT_CONNECTOR_TIMING = ConnectorTiming(
    heartbeat_interval_ms=HEARTBEAT_INTERVAL_MS,
    heartbeat_timeout_ms=HEARTBEAT_TIMEOUT_MS,
    reconnect_base_ms=RECONNECT_BASE_MS,
    reconnect_max_ms=RECONNECT_MAX_MS,
)


def reconnect_delay_ms(*, attempt: int, timing: ConnectorTiming = DEFAULT_CONNECTOR_TIMING) -> int:
    raise NotImplementedError("reconnect_delay_ms is not implemented")


async def probe_connector_status(*, probe_link: str) -> int:
    raise NotImplementedError("probe_connector_status is not implemented")


async def wait_or_stop(*, delay_ms: int, stop: asyncio.Event) -> None:
    raise NotImplementedError("wait_or_stop is not implemented")


async def run_connector_socket(
    *,
    socket_link: str,
    stop: asyncio.Event,
    hand_off: Callable[..., Awaitable[None]],
    timing: ConnectorTiming = DEFAULT_CONNECTOR_TIMING,
    probe_status: Callable[..., Awaitable[int]] = probe_connector_status,
    wait: Callable[..., Awaitable[None]] = wait_or_stop,
) -> int:
    raise NotImplementedError("run_connector_socket is not implemented")
