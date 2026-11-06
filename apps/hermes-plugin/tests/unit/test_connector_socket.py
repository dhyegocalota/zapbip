import asyncio
import json
from collections.abc import Awaitable, Callable, Coroutine
from typing import Any

import httpx
import pytest
from fake_connector import PING_TEXT, FakeConnector, send_hello
from frame_builders import hello_text, messages_text, text_message
from socket_harness import FAST_TIMING, HandedOff, running_socket
from websockets.asyncio.server import ServerConnection

from zapbip_platform.connector_socket import ConnectorTiming, reconnect_delay_ms
from zapbip_platform.constants import REPLACED_CLOSE_CODE, SEEN_MESSAGE_LIMIT

FAILURE_EXIT_CODE = 1
CLEAN_EXIT_CODE = 0
PROMPT_SECONDS = 0.1
HEARTBEAT_INTERVAL_MS = 50
FRAME_CHUNK_SIZE = 200


def run(scenario: Coroutine[Any, Any, None]) -> None:
    asyncio.run(scenario)


def messages_of(*message_ids: str) -> str:
    return messages_text(messages=[text_message(message_id=message_id, text="oi") for message_id in message_ids])


def done_text(*, message_id: str) -> str:
    return json.dumps({"type": "done", "messageId": message_id}, separators=(",", ":"))


def on_open_sending(*frames: str) -> Callable[[ServerConnection, int], Awaitable[None]]:
    async def on_open(connection: ServerConnection, index: int) -> None:
        await send_hello(connection, index)
        for frame in frames:
            await connection.send(frame)

    return on_open


class WaitRecorder:
    def __init__(self) -> None:
        self.delays_ms: list[int] = []

    async def wait(self, *, delay_ms: int, stop: asyncio.Event) -> None:
        self.delays_ms.append(delay_ms)


def test_probe_426_proceeds() -> None:
    async def scenario() -> None:
        async with FakeConnector() as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: connector.open_count == 1)
            assert connector.probe_count == 1

    run(scenario())


@pytest.mark.parametrize("status", [401, 404, 500])
def test_refused_probe_stops(status: int) -> None:
    async def scenario() -> None:
        async with FakeConnector(probe_status=status) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off) as running:
                exit_code = await running.task
            assert exit_code == FAILURE_EXIT_CODE
            assert connector.open_count == 0
            assert connector.probe_count == 1

    run(scenario())


def test_probe_network_error_retries() -> None:
    attempts: list[int] = []

    async def failing_twice_then_upgrade_required(*, probe_link: str) -> int:
        attempts.append(1)
        if len(attempts) <= 2:
            raise httpx.ConnectError("refused")
        return 426

    async def scenario() -> None:
        recorder = WaitRecorder()
        async with FakeConnector() as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(
                connector=connector,
                hand_off=handed_off.hand_off,
                timing=ConnectorTiming(25_000, 10_000, 1_000, 30_000),
                probe_status=failing_twice_then_upgrade_required,
                wait=recorder.wait,
            ):
                await connector.until(condition=lambda: connector.open_count == 1)
            assert recorder.delays_ms == [1_000, 2_000]

    run(scenario())


def test_open_sends_nothing_before_hello() -> None:
    frames_before_hello: list[int] = []

    async def scenario() -> None:
        async def on_open(connection: ServerConnection, index: int) -> None:
            frames_before_hello.append(len(connector.received_frames))
            await send_hello(connection, index)

        async with FakeConnector(on_open=on_open) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: connector.open_count == 1)
            assert frames_before_hello == [0]

    run(scenario())


def test_messages_are_handed_off_in_order() -> None:
    async def scenario() -> None:
        async with FakeConnector(on_open=on_open_sending(messages_of("msg_1", "msg_2"))) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: len(connector.received_frames) == 2)
            assert handed_off.message_ids == ["msg_1", "msg_2"]

    run(scenario())


def test_done_follows_each_handoff() -> None:
    async def scenario() -> None:
        async with FakeConnector(on_open=on_open_sending(messages_of("msg_1", "msg_2"))) as connector:
            handed_off = HandedOff(connector=connector)
            handed_off.gates["msg_1"] = asyncio.Event()
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: handed_off.message_ids == ["msg_1"])
                assert connector.received_frames == []
                handed_off.gates["msg_1"].set()
                await connector.until(condition=lambda: len(connector.received_frames) == 2)
            assert connector.received_frames == [done_text(message_id="msg_1"), done_text(message_id="msg_2")]
            assert handed_off.sent_dones_at_start["msg_1"] == []
            assert len(handed_off.sent_dones_at_start["msg_2"]) == 1
            assert "msg_1" in handed_off.sent_dones_at_start["msg_2"][0]

    run(scenario())


def test_handoff_failure_sends_no_done_and_is_retried_after_reconnect() -> None:
    async def scenario() -> None:
        async def on_open(connection: ServerConnection, index: int) -> None:
            await send_hello(connection, index)
            await connection.send(messages_of("msg_1", "msg_2") if index == 0 else messages_of("msg_1"))

        async with FakeConnector(on_open=on_open) as connector:
            handed_off = HandedOff(connector=connector)
            handed_off.failing_ids.add("msg_1")
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: connector.received_frames == [done_text(message_id="msg_2")])
                connector.drop_connections()
                await connector.until(condition=lambda: done_text(message_id="msg_1") in connector.received_frames)
            assert handed_off.message_ids == ["msg_1", "msg_2", "msg_1"]
            assert connector.received_frames == [done_text(message_id="msg_2"), done_text(message_id="msg_1")]

    run(scenario())


def test_duplicate_while_running_is_handed_once() -> None:
    async def scenario() -> None:
        async with FakeConnector(on_open=on_open_sending(messages_of("msg_1"))) as connector:
            handed_off = HandedOff(connector=connector)
            handed_off.gates["msg_1"] = asyncio.Event()
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: handed_off.message_ids == ["msg_1"])
                await connector.broadcast(text=messages_of("msg_1"))
                await connector.broadcast(text=messages_of("msg_3"))
                handed_off.gates["msg_1"].set()
                await connector.until(condition=lambda: len(connector.received_frames) == 2)
            assert handed_off.message_ids == ["msg_1", "msg_3"]

    run(scenario())


def test_duplicate_after_done_is_skipped() -> None:
    async def scenario() -> None:
        async with FakeConnector(on_open=on_open_sending(messages_of("msg_1"))) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: len(connector.received_frames) == 1)
                await connector.broadcast(text=messages_of("msg_1", "msg_2"))
                await connector.until(condition=lambda: len(connector.received_frames) == 3)
            assert handed_off.message_ids == ["msg_1", "msg_2"]


def test_redelivery_after_done_is_acknowledged_again() -> None:
    async def scenario() -> None:
        async with FakeConnector(on_open=on_open_sending(messages_of("msg_1"))) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: len(connector.received_frames) == 1)
                await connector.broadcast(text=messages_of("msg_1"))
                await connector.until(condition=lambda: len(connector.received_frames) == 2)
            assert handed_off.message_ids == ["msg_1"]
            assert connector.received_frames == [done_text(message_id="msg_1")] * 2

    run(scenario())


def test_seen_set_is_bounded() -> None:
    message_ids = [f"msg_{number}" for number in range(SEEN_MESSAGE_LIMIT + 1)]
    chunks = [message_ids[start : start + FRAME_CHUNK_SIZE] for start in range(0, len(message_ids), FRAME_CHUNK_SIZE)]

    async def scenario() -> None:
        async with FakeConnector(on_open=on_open_sending(*[messages_of(*chunk) for chunk in chunks])) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: len(connector.received_frames) == len(message_ids))
                await connector.broadcast(text=messages_of("msg_0"))
                await connector.broadcast(text=messages_of(message_ids[-1], "sentinel"))
                await connector.until(condition=lambda: len(connector.received_frames) == len(message_ids) + 3)
            assert handed_off.message_ids[len(message_ids) :] == ["msg_0", "sentinel"]

    run(scenario())


def test_heartbeat_sends_ping() -> None:
    async def scenario() -> None:
        async with FakeConnector() as connector:
            handed_off = HandedOff(connector=connector)
            timing = ConnectorTiming(HEARTBEAT_INTERVAL_MS, 1_000, 5, 20)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off, timing=timing):
                await connector.until(condition=lambda: connector.received_frames.count(PING_TEXT) == 3)
            assert connector.open_count == 1

    run(scenario())


def test_no_frame_within_the_timeout_reconnects() -> None:
    async def scenario() -> None:
        async with FakeConnector(answer_pings=False) as connector:
            handed_off = HandedOff(connector=connector)
            timing = ConnectorTiming(20, 50, 5, 20)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off, timing=timing):
                await connector.until(condition=lambda: connector.open_count >= 2)

    run(scenario())


def test_any_frame_is_proof_of_life() -> None:
    async def answer_with_empty_messages(connection: ServerConnection, frame: str) -> None:
        await connection.send(messages_text(messages=[]))

    async def scenario() -> None:
        async with FakeConnector(answer_pings=False, on_frame=answer_with_empty_messages) as connector:
            handed_off = HandedOff(connector=connector)
            timing = ConnectorTiming(20, 200, 5, 20)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off, timing=timing):
                await connector.until(condition=lambda: connector.received_frames.count(PING_TEXT) >= 4)
            assert connector.open_count == 1

    run(scenario())


def test_replaced_4001_stops_without_retry() -> None:
    async def on_open(connection: ServerConnection, index: int) -> None:
        await send_hello(connection, index)
        await connection.close(code=REPLACED_CLOSE_CODE)

    async def scenario() -> None:
        async with FakeConnector(on_open=on_open) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off) as running:
                exit_code = await running.task
            assert exit_code == CLEAN_EXIT_CODE
            assert connector.open_count == 1
            assert connector.logged(event="connector_replaced")

    run(scenario())


def test_abnormal_close_reconnects_and_rereads() -> None:
    async def on_open(connection: ServerConnection, index: int) -> None:
        await send_hello(connection, index)
        await connection.send(messages_of("msg_1") if index == 0 else messages_of("msg_2"))

    async def scenario() -> None:
        recorder = WaitRecorder()
        async with FakeConnector(on_open=on_open) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(
                connector=connector,
                hand_off=handed_off.hand_off,
                timing=ConnectorTiming(25_000, 10_000, 1_000, 30_000),
                wait=recorder.wait,
            ):
                await connector.until(condition=lambda: connector.received_frames == [done_text(message_id="msg_1")])
                connector.drop_connections()
                await connector.until(condition=lambda: len(connector.received_frames) == 2)
            assert recorder.delays_ms[0] == 1_000
            assert handed_off.message_ids == ["msg_1", "msg_2"]

    run(scenario())


def test_backoff_sequence_is_capped() -> None:
    delays = [reconnect_delay_ms(attempt=attempt) for attempt in range(7)]

    assert delays == [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]


def test_successful_open_resets_attempts() -> None:
    async def scenario() -> None:
        recorder = WaitRecorder()
        async with FakeConnector(refused_upgrades=2) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(
                connector=connector,
                hand_off=handed_off.hand_off,
                timing=ConnectorTiming(25_000, 10_000, 1_000, 30_000),
                wait=recorder.wait,
            ):
                await connector.until(condition=lambda: connector.open_count == 1)
                connector.drop_connections()
                await connector.until(condition=lambda: len(recorder.delays_ms) == 3)
            assert recorder.delays_ms[:3] == [1_000, 2_000, 1_000]

    run(scenario())


def test_stop_during_backoff_returns_promptly() -> None:
    async def scenario() -> None:
        async with FakeConnector() as connector:
            handed_off = HandedOff(connector=connector)
            timing = ConnectorTiming(25_000, 10_000, 30_000, 30_000)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off, timing=timing) as running:
                await connector.until(condition=lambda: connector.open_count == 1)
                connector.drop_connections()
                await connector.until(condition=lambda: connector.logged(event="connector_reconnecting"))
                started_at = asyncio.get_running_loop().time()
                running.stop.set()
                await running.task
                assert asyncio.get_running_loop().time() - started_at < PROMPT_SECONDS
            assert connector.open_count == 1

    run(scenario())


def test_hello_wake_mode_is_logged_not_applied() -> None:
    async def on_open(connection: ServerConnection, index: int) -> None:
        await connection.send(hello_text(previous_wake_mode="scheduled"))

    async def scenario() -> None:
        async with FakeConnector(on_open=on_open) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: connector.logged(event="connector_connected"))
            assert connector.received_frames == []
            assert any("scheduled" in line for line in connector.logs)

    run(scenario())


def test_close_after_hello_reconnects_without_handoff() -> None:
    async def on_open(connection: ServerConnection, index: int) -> None:
        await send_hello(connection, index)
        await connection.close(code=1011)

    async def scenario() -> None:
        async with FakeConnector(on_open=on_open) as connector:
            handed_off = HandedOff(connector=connector)
            async with running_socket(connector=connector, hand_off=handed_off.hand_off):
                await connector.until(condition=lambda: connector.open_count >= 2)
            assert handed_off.message_ids == []

    run(scenario())
