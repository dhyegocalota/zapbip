import asyncio
from collections.abc import Awaitable, Callable


async def run_connector_socket(
    *,
    socket_link: str,
    stop: asyncio.Event,
    hand_off: Callable[..., Awaitable[None]],
) -> int:
    raise NotImplementedError("run_connector_socket is not implemented")
