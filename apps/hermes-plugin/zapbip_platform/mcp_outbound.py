from typing import Any

import httpx

from zapbip_platform.constants import (
    MCP_PROTOCOL_VERSION,
    MCP_REQUEST_TIMEOUT_SECONDS,
    PLUGIN_NAME,
    PLUGIN_VERSION,
    SEND_MESSAGE_TOOL_NAME,
)

JSON_RPC_VERSION = "2.0"
INITIALIZE_REQUEST_ID = 1
CALL_REQUEST_ID = 2
MCP_HEADERS = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
UNREADABLE_RESPONSE_MESSAGE = "the MCP route answered with an unreadable body"


class McpOutboundError(Exception):
    pass


def request_body(*, method: str, params: dict[str, Any], request_id: int | None) -> dict[str, Any]:
    body: dict[str, Any] = {"jsonrpc": JSON_RPC_VERSION, "method": method, "params": params}
    if request_id is None:
        return body
    return {**body, "id": request_id}


async def post_body(*, client: httpx.AsyncClient, mcp_link: str, body: dict[str, Any]) -> httpx.Response:
    response = await client.post(mcp_link, json=body, headers=MCP_HEADERS)
    if not response.is_success:
        raise McpOutboundError(f"HTTP {response.status_code}")
    return response


def result_of(*, response: httpx.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError as error:
        raise McpOutboundError(UNREADABLE_RESPONSE_MESSAGE) from error
    if "error" in body:
        raise McpOutboundError(str(body["error"].get("message")))
    result: dict[str, Any] = body["result"]
    return result


def tool_error_text_of(*, result: dict[str, Any]) -> str:
    return "".join(item["text"] for item in result["content"] if item["type"] == "text")


async def send_owner_text(*, mcp_link: str, text: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
    if text == "":
        return
    initialize = request_body(
        method="initialize",
        request_id=INITIALIZE_REQUEST_ID,
        params={
            "protocolVersion": MCP_PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {"name": PLUGIN_NAME, "version": PLUGIN_VERSION},
        },
    )
    initialized = request_body(method="notifications/initialized", params={}, request_id=None)
    call = request_body(
        method="tools/call",
        request_id=CALL_REQUEST_ID,
        params={"name": SEND_MESSAGE_TOOL_NAME, "arguments": {"text": text}},
    )
    try:
        async with httpx.AsyncClient(transport=transport, timeout=MCP_REQUEST_TIMEOUT_SECONDS) as client:
            result_of(response=await post_body(client=client, mcp_link=mcp_link, body=initialize))
            await post_body(client=client, mcp_link=mcp_link, body=initialized)
            result = result_of(response=await post_body(client=client, mcp_link=mcp_link, body=call))
    except httpx.HTTPError as error:
        raise McpOutboundError(type(error).__name__) from error
    if result.get("isError"):
        raise McpOutboundError(tool_error_text_of(result=result))
