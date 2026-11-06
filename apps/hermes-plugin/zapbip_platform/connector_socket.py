import asyncio
import contextlib
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from .constants import (
    ABNORMAL_CLOSE_CODE,
    CLEAN_EXIT_CODE,
    CONNECTOR_PING_TEXT,
    FAILURE_EXIT_CODE,
    HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_TIMEOUT_MS,
    MILLISECONDS_PER_SECOND,
    NORMAL_CLOSE_CODE,
    RECONNECT_BASE_MS,
    RECONNECT_MAX_MS,
    REPLACED_CLOSE_CODE,
    UPGRADE_REQUIRED_STATUS,
    ConnectorFrameType,
    ConnectorLogEvent,
    PluginLogEvent,
)
from .frames import FrameBody, parse_server_frame
from .log import log_connector_event
from .message_delivery import MessageDelivery

PROBE_SCHEMES = {"ws": "http", "wss": "https"}


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


@dataclass(frozen=True)
class SocketEnd:
    code: int
    was_opened: bool


@dataclass
class ActiveConnection:
    connection: ClientConnection | None = None


def reconnect_delay_ms(*, attempt: int, timing: ConnectorTiming = DEFAULT_CONNECTOR_TIMING) -> int:
    if attempt < 0:
        raise ValueError("the reconnect attempt cannot be negative")
    return int(min(timing.reconnect_max_ms, timing.reconnect_base_ms * 2**attempt))


def probe_link_of(*, socket_link: str) -> str:
    parts = urlsplit(socket_link)
    return parts._replace(scheme=PROBE_SCHEMES[parts.scheme]).geturl()


async def probe_connector_status(*, probe_link: str) -> int:
    async with httpx.AsyncClient() as client:
        response = await client.get(probe_link)
    return response.status_code


async def wait_or_stop(*, delay_ms: int, stop: asyncio.Event) -> None:
    with contextlib.suppress(TimeoutError):
        await asyncio.wait_for(stop.wait(), timeout=delay_ms / MILLISECONDS_PER_SECOND)


async def probe_until_answered(
    *,
    probe_link: str,
    stop: asyncio.Event,
    timing: ConnectorTiming,
    probe_status: Callable[..., Awaitable[int]],
    wait: Callable[..., Awaitable[None]],
) -> int | None:
    attempt = 0
    while not stop.is_set():
        try:
            return await probe_status(probe_link=probe_link)
        except httpx.HTTPError as error:
            log_connector_event(event=PluginLogEvent.PROBE_FAILED, attempt=attempt, error=type(error).__name__)
            await wait(delay_ms=reconnect_delay_ms(attempt=attempt, timing=timing), stop=stop)
            attempt += 1
    return None


def close_code_of(*, connection: ClientConnection) -> int:
    code = connection.close_code
    if code is None:
        return ABNORMAL_CLOSE_CODE
    return code


async def send_done(*, active: ActiveConnection, message_id: str) -> None:
    connection = active.connection
    if connection is None:
        return
    frame = {"type": ConnectorFrameType.DONE.value, "messageId": message_id}
    try:
        await connection.send(json.dumps(frame, separators=(",", ":")))
    except ConnectionClosed:
        return
    log_connector_event(event=ConnectorLogEvent.DONE_SENT, messageId=message_id)


def handle_hello(*, frame: FrameBody, delivery: MessageDelivery) -> None:
    log_connector_event(
        event=ConnectorLogEvent.CONNECTOR_CONNECTED, agent=frame["agent"], previousWakeMode=frame["previousWakeMode"]
    )


def handle_messages(*, frame: FrameBody, delivery: MessageDelivery) -> None:
    log_connector_event(event=ConnectorLogEvent.MESSAGES_RECEIVED, count=len(frame["messages"]))
    delivery.enqueue(messages=frame["messages"])


def handle_pong(*, frame: FrameBody, delivery: MessageDelivery) -> None:
    return


FRAME_HANDLERS: dict[str, Callable[..., None]] = {
    ConnectorFrameType.HELLO.value: handle_hello,
    ConnectorFrameType.MESSAGES.value: handle_messages,
    ConnectorFrameType.PONG.value: handle_pong,
}


def handle_data(*, data: str | bytes, delivery: MessageDelivery) -> None:
    is_binary = isinstance(data, bytes)
    text = "" if is_binary else str(data)
    parsed = parse_server_frame(text=text, is_binary=is_binary)
    if parsed.frame is None:
        reason = parsed.reason
        log_connector_event(event=ConnectorLogEvent.FRAME_REJECTED, reason=None if reason is None else reason.value)
        return
    FRAME_HANDLERS[parsed.frame["type"]](frame=parsed.frame, delivery=delivery)


async def receive_frames(
    *, connection: ClientConnection, frame_received: asyncio.Event, delivery: MessageDelivery
) -> None:
    try:
        async for data in connection:
            frame_received.set()
            handle_data(data=data, delivery=delivery)
    except ConnectionClosed:
        return


async def keep_heartbeat(
    *, connection: ClientConnection, frame_received: asyncio.Event, timing: ConnectorTiming, stop: asyncio.Event
) -> None:
    while True:
        await wait_or_stop(delay_ms=timing.heartbeat_interval_ms, stop=stop)
        if stop.is_set():
            return
        frame_received.clear()
        try:
            await connection.send(CONNECTOR_PING_TEXT)
            await asyncio.wait_for(frame_received.wait(), timeout=timing.heartbeat_timeout_ms / MILLISECONDS_PER_SECOND)
        except (TimeoutError, ConnectionClosed):
            return


async def hold_socket(
    *,
    socket_link: str,
    stop: asyncio.Event,
    timing: ConnectorTiming,
    delivery: MessageDelivery,
    active: ActiveConnection,
) -> SocketEnd:
    try:
        connection = await connect(socket_link, ping_interval=None)
    except (OSError, WebSocketException, TimeoutError) as error:
        log_connector_event(event=ConnectorLogEvent.CONNECTOR_CLOSED, error=type(error).__name__)
        return SocketEnd(code=ABNORMAL_CLOSE_CODE, was_opened=False)
    active.connection = connection
    frame_received = asyncio.Event()
    receiving = asyncio.create_task(receive_frames(connection=connection, frame_received=frame_received, delivery=delivery))
    beating = asyncio.create_task(
        keep_heartbeat(connection=connection, frame_received=frame_received, timing=timing, stop=stop)
    )
    stopping = asyncio.create_task(stop.wait())
    await asyncio.wait({receiving, beating, stopping}, return_when=asyncio.FIRST_COMPLETED)
    code = close_code_of(connection=connection) if receiving.done() else NORMAL_CLOSE_CODE
    if beating.done() and not receiving.done() and not stop.is_set():
        code = ABNORMAL_CLOSE_CODE
    for task in (receiving, beating, stopping):
        task.cancel()
    await asyncio.gather(receiving, beating, stopping, return_exceptions=True)
    await connection.close()
    active.connection = None
    event = ConnectorLogEvent.CONNECTOR_REPLACED if code == REPLACED_CLOSE_CODE else ConnectorLogEvent.CONNECTOR_CLOSED
    log_connector_event(event=event, code=code)
    return SocketEnd(code=code, was_opened=True)


async def run_connector_socket(
    *,
    socket_link: str,
    stop: asyncio.Event,
    hand_off: Callable[..., Awaitable[None]],
    timing: ConnectorTiming = DEFAULT_CONNECTOR_TIMING,
    probe_status: Callable[..., Awaitable[int]] = probe_connector_status,
    wait: Callable[..., Awaitable[None]] = wait_or_stop,
) -> int:
    status = await probe_until_answered(
        probe_link=probe_link_of(socket_link=socket_link),
        stop=stop,
        timing=timing,
        probe_status=probe_status,
        wait=wait,
    )
    if status is None:
        return CLEAN_EXIT_CODE
    if status != UPGRADE_REQUIRED_STATUS:
        log_connector_event(event=ConnectorLogEvent.CONNECTOR_CLOSED, status=status)
        return FAILURE_EXIT_CODE
    active = ActiveConnection()
    delivery = MessageDelivery(hand_off=hand_off, send_done=lambda *, message_id: send_done(active=active, message_id=message_id))
    worker = asyncio.create_task(delivery.run())
    try:
        return await reconnect_until_stopped(
            socket_link=socket_link, stop=stop, timing=timing, delivery=delivery, active=active, wait=wait
        )
    finally:
        worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)


async def reconnect_until_stopped(
    *,
    socket_link: str,
    stop: asyncio.Event,
    timing: ConnectorTiming,
    delivery: MessageDelivery,
    active: ActiveConnection,
    wait: Callable[..., Awaitable[None]],
) -> int:
    attempt = 0
    while not stop.is_set():
        end = await hold_socket(socket_link=socket_link, stop=stop, timing=timing, delivery=delivery, active=active)
        if end.code == REPLACED_CLOSE_CODE:
            return CLEAN_EXIT_CODE
        if stop.is_set():
            break
        failed_attempts = 0 if end.was_opened else attempt
        delay_ms = reconnect_delay_ms(attempt=failed_attempts, timing=timing)
        log_connector_event(event=ConnectorLogEvent.CONNECTOR_RECONNECTING, attempt=failed_attempts, delayMs=delay_ms)
        await wait(delay_ms=delay_ms, stop=stop)
        attempt = failed_attempts + 1
    return CLEAN_EXIT_CODE
