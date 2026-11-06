import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from frame_builders import MESSAGE_AT, text_message
from gateway.config import PlatformConfig

from zapbip_platform import register
from zapbip_platform.adapter import ZapbipAdapter
from zapbip_platform.constants import CONNECTION_LINK_ENV
from zapbip_platform.mcp_outbound import McpOutboundError

CONNECTION_LINK = "https://zapbip.example/c/zb_conn_secret/mcp"
PLUGIN_DIRECTORY = Path(__file__).resolve().parent.parent.parent / "zapbip_platform"


class SocketRecorder:
    def __init__(self) -> None:
        self.runs = 0
        self.started = asyncio.Event()
        self.socket_links: list[str] = []
        self.stop: asyncio.Event | None = None
        self.hand_off: Any = None

    async def run_socket(self, *, socket_link: str, stop: asyncio.Event, hand_off: Any) -> int:
        self.runs += 1
        self.socket_links.append(socket_link)
        self.stop = stop
        self.hand_off = hand_off
        self.started.set()
        await stop.wait()
        return 0


class TextRecorder:
    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []
        self.failure: Exception | None = None

    async def send_text(self, *, mcp_link: str, text: str) -> None:
        self.sent.append({"mcp_link": mcp_link, "text": text})
        if self.failure is not None:
            raise self.failure


class RegistrationContext:
    def __init__(self) -> None:
        self.registrations: list[dict[str, Any]] = []

    def register_platform(self, **registration: Any) -> None:
        self.registrations.append(registration)


@pytest.fixture(autouse=True)
def connection_link_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(CONNECTION_LINK_ENV, CONNECTION_LINK)


def gateway_view_of(*, adapter: ZapbipAdapter) -> Any:
    return adapter


def build_adapter(*, sockets: SocketRecorder, texts: TextRecorder) -> ZapbipAdapter:
    return ZapbipAdapter(PlatformConfig(), run_socket=sockets.run_socket, send_text=texts.send_text)


def test_connect_returns_true_with_one_socket_task() -> None:
    async def scenario() -> None:
        sockets = SocketRecorder()
        adapter = build_adapter(sockets=sockets, texts=TextRecorder())

        assert await adapter.connect() is True
        await sockets.started.wait()

        assert sockets.runs == 1
        assert sockets.socket_links == ["wss://zapbip.example/c/zb_conn_secret/connector"]
        await adapter.disconnect()

    asyncio.run(scenario())


def test_connect_twice_keeps_one_socket_task() -> None:
    async def scenario() -> None:
        sockets = SocketRecorder()
        adapter = build_adapter(sockets=sockets, texts=TextRecorder())

        assert await adapter.connect() is True
        assert await adapter.connect() is True
        await sockets.started.wait()

        assert sockets.runs == 1
        await adapter.disconnect()

    asyncio.run(scenario())


def test_disconnect_stops_the_socket_task() -> None:
    async def scenario() -> None:
        sockets = SocketRecorder()
        adapter = build_adapter(sockets=sockets, texts=TextRecorder())
        await adapter.connect()
        await sockets.started.wait()

        await adapter.disconnect()

        assert sockets.stop is not None and sockets.stop.is_set()
        remaining = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
        assert remaining == []

    asyncio.run(scenario())


def test_a_socket_that_ends_marks_the_adapter_disconnected() -> None:
    async def refused_socket(*, socket_link: str, stop: asyncio.Event, hand_off: Any) -> int:
        return 1

    async def scenario() -> None:
        adapter = ZapbipAdapter(PlatformConfig(), run_socket=refused_socket, send_text=TextRecorder().send_text)
        await adapter.connect()
        assert gateway_view_of(adapter=adapter)._running is True
        await gateway_view_of(adapter=adapter)._socket_task
        assert gateway_view_of(adapter=adapter)._running is False

    asyncio.run(scenario())


def test_a_missing_connection_link_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(CONNECTION_LINK_ENV)

    with pytest.raises(ValueError, match=CONNECTION_LINK_ENV):
        build_adapter(sockets=SocketRecorder(), texts=TextRecorder())


def test_handle_message_gets_the_handoff_text() -> None:
    async def scenario() -> None:
        sockets = SocketRecorder()
        adapter = build_adapter(sockets=sockets, texts=TextRecorder())
        await adapter.connect()
        await sockets.started.wait()

        await sockets.hand_off(message=text_message(message_id="msg_9", text="oi"))

        [event] = gateway_view_of(adapter=adapter).handled_events
        assert event.text == "oi"
        assert event.source.chat_id == "owner"
        assert event.message_id == "msg_9"
        assert event.timestamp == datetime.fromtimestamp(MESSAGE_AT / 1_000, tz=UTC)
        await adapter.disconnect()

    asyncio.run(scenario())


def test_handle_message_failure_propagates_so_no_done_is_sent() -> None:
    async def scenario() -> None:
        sockets = SocketRecorder()
        adapter = build_adapter(sockets=sockets, texts=TextRecorder())
        gateway_view_of(adapter=adapter).handle_message_error = RuntimeError("refused")
        await adapter.connect()
        await sockets.started.wait()

        with pytest.raises(RuntimeError):
            await sockets.hand_off(message=text_message(message_id="msg_9", text="oi"))
        await adapter.disconnect()

    asyncio.run(scenario())


def test_send_posts_to_the_owner_through_the_mcp_link() -> None:
    texts = TextRecorder()
    adapter = build_adapter(sockets=SocketRecorder(), texts=texts)

    result = asyncio.run(adapter.send(chat_id="owner", content="olá"))

    assert result.success
    assert texts.sent == [{"mcp_link": CONNECTION_LINK, "text": "olá"}]


def test_send_refuses_another_chat() -> None:
    texts = TextRecorder()
    adapter = build_adapter(sockets=SocketRecorder(), texts=texts)

    result = asyncio.run(adapter.send(chat_id="someone-else", content="x"))

    assert not result.success
    assert texts.sent == []


def test_send_surfaces_a_tool_error_without_the_secret() -> None:
    texts = TextRecorder()
    texts.failure = McpOutboundError("send_message failed: text too long")
    adapter = build_adapter(sockets=SocketRecorder(), texts=texts)

    result = asyncio.run(adapter.send(chat_id="owner", content="x"))

    assert not result.success
    assert result.error is not None
    assert "text too long" in result.error
    assert "zb_conn_secret" not in result.error


def test_chat_info_names_the_owner() -> None:
    adapter = build_adapter(sockets=SocketRecorder(), texts=TextRecorder())

    assert asyncio.run(adapter.get_chat_info("owner")) == {"name": "owner", "type": "dm"}


def registered_platform() -> dict[str, Any]:
    context = RegistrationContext()
    register(context)
    [registration] = context.registrations
    return registration


def test_allow_all_is_not_set() -> None:
    registration = registered_platform()

    assert not registration.get("allow_all_env")
    assert registration["allowed_users_env"]


def test_register_declares_only_the_connection_link() -> None:
    registration = registered_platform()

    assert registration["required_env"] == [CONNECTION_LINK_ENV]
    assert registration["name"] == "zapbip"


def plugin_yaml_lines() -> list[str]:
    return (PLUGIN_DIRECTORY / "plugin.yaml").read_text().splitlines()


def test_plugin_yaml_matches_register() -> None:
    assert "name: zapbip-platform" in plugin_yaml_lines()
    assert "kind: platform" in plugin_yaml_lines()
    assert registered_platform()["name"] == "zapbip"


def test_required_env_lists_only_the_link() -> None:
    lines = plugin_yaml_lines()
    required = [line for line in lines if line.strip().startswith("- name:")]

    assert required == [f"  - name: {CONNECTION_LINK_ENV}"]
    assert "    password: true" in lines
