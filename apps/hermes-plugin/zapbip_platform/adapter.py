from collections.abc import Awaitable, Callable
from typing import Any

from zapbip_platform.connector_socket import run_connector_socket
from zapbip_platform.mcp_outbound import send_owner_text


class ZapbipAdapter:
    def __init__(
        self,
        config: Any,
        *,
        run_socket: Callable[..., Awaitable[int]] = run_connector_socket,
        send_text: Callable[..., Awaitable[None]] = send_owner_text,
    ) -> None:
        raise NotImplementedError("ZapbipAdapter is not implemented")
