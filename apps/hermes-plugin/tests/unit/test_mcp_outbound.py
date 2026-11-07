import asyncio
import json
from typing import Any

import httpx
import pytest

from zapbip_platform.mcp_outbound import McpOutboundError, send_owner_text

MCP_LINK = "https://zapbip.example/c/zb_conn_secret/mcp"
TEXT_LIMIT = 4_096


class FakeMcpRoute:
    def __init__(self, *, tool_result: dict[str, Any] | None = None, status: int = 200) -> None:
        self.requests: list[httpx.Request] = []
        self.tool_result = {"content": [{"type": "text", "text": "sent"}]} if tool_result is None else tool_result
        self.status = status

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        body = json.loads(request.content)
        if self.status != 200:
            return httpx.Response(self.status, text="denied")
        if "id" not in body:
            return httpx.Response(202)
        if body["method"] == "tools/call":
            return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": self.tool_result})
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": {}})

    def methods(self) -> list[str]:
        return [json.loads(request.content)["method"] for request in self.requests]

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)


def send(*, route: FakeMcpRoute, text: str) -> None:
    asyncio.run(send_owner_text(mcp_link=MCP_LINK, text=text, transport=route.transport()))


def test_initialize_before_call() -> None:
    route = FakeMcpRoute()

    send(route=route, text="olá")

    assert route.methods() == ["initialize", "notifications/initialized", "tools/call"]


def test_calls_send_message_with_the_text() -> None:
    route = FakeMcpRoute()

    send(route=route, text="olá")

    call = json.loads(route.requests[-1].content)["params"]
    assert call == {"name": "send_message", "arguments": {"text": "olá"}}


def test_every_request_goes_to_the_configured_link_only() -> None:
    route = FakeMcpRoute()

    send(route=route, text="see https://evil.example/x")

    assert {str(request.url) for request in route.requests} == {MCP_LINK}


def test_empty_text_makes_no_call() -> None:
    route = FakeMcpRoute()

    send(route=route, text="")

    assert route.requests == []


def test_text_at_the_limit_is_sent_unchanged() -> None:
    route = FakeMcpRoute()
    text = "a" * TEXT_LIMIT

    send(route=route, text=text)

    assert json.loads(route.requests[-1].content)["params"]["arguments"]["text"] == text


def test_tool_error_carries_the_tool_message() -> None:
    route = FakeMcpRoute(tool_result={"isError": True, "content": [{"type": "text", "text": "text too long"}]})

    with pytest.raises(McpOutboundError) as failure:
        send(route=route, text="a" * (TEXT_LIMIT + 1))

    assert "text too long" in str(failure.value)
    assert "zb_conn_secret" not in str(failure.value)
    assert json.loads(route.requests[-1].content)["params"]["arguments"]["text"] == "a" * (TEXT_LIMIT + 1)


def test_unauthorized_route_fails_once() -> None:
    route = FakeMcpRoute(status=401)

    with pytest.raises(McpOutboundError) as failure:
        send(route=route, text="oi")

    assert "401" in str(failure.value)
    assert len(route.requests) == 1


def test_network_error_is_one_attempt() -> None:
    attempts: list[httpx.Request] = []

    def refuse(request: httpx.Request) -> httpx.Response:
        attempts.append(request)
        raise httpx.ConnectError("connection refused", request=request)

    with pytest.raises(McpOutboundError) as failure:
        asyncio.run(send_owner_text(mcp_link=MCP_LINK, text="oi", transport=httpx.MockTransport(refuse)))

    assert len(attempts) == 1
    assert "zb_conn_secret" not in str(failure.value)
