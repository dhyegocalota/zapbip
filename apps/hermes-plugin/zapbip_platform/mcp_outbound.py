import httpx


class McpOutboundError(Exception):
    pass


async def send_owner_text(*, mcp_link: str, text: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
    raise NotImplementedError("send_owner_text is not implemented")
