import asyncio
import logging
from collections.abc import Awaitable, Callable
from http import HTTPStatus
from types import TracebackType
from typing import Self

from websockets.asyncio.server import Server, ServerConnection, serve
from websockets.datastructures import Headers
from websockets.exceptions import ConnectionClosed
from websockets.http11 import Request, Response

from frame_builders import hello_text

LOCAL_HOST = "127.0.0.1"
UNTIL_TIMEOUT_SECONDS = 5.0
PING_TEXT = '{"type":"ping"}'
PONG_TEXT = '{"type":"pong"}'
UPGRADE_HEADER = "Upgrade"

LOGGER_NAME = "zapbip_platform"

OnOpen = Callable[[ServerConnection, int], Awaitable[None]]
OnFrame = Callable[[ServerConnection, str], Awaitable[None]]


async def send_hello(connection: ServerConnection, index: int) -> None:
    await connection.send(hello_text())


class LogCollector(logging.Handler):
    def __init__(self, *, connector: "FakeConnector") -> None:
        super().__init__(level=logging.INFO)
        self._connector = connector

    def emit(self, record: logging.LogRecord) -> None:
        self._connector.logs.append(record.getMessage())
        self._connector.wake()


class FakeConnector:
    def __init__(
        self,
        *,
        probe_status: int = 426,
        on_open: OnOpen = send_hello,
        on_frame: OnFrame | None = None,
        answer_pings: bool = True,
        refused_upgrades: int = 0,
    ) -> None:
        self.probe_status = probe_status
        self.probe_count = 0
        self.open_count = 0
        self.timeline: list[str] = []
        self.logs: list[str] = []
        self._log_collector = LogCollector(connector=self)
        self.connections: list[ServerConnection] = []
        self._on_open = on_open
        self._on_frame = on_frame
        self._answer_pings = answer_pings
        self._refused_upgrades = refused_upgrades
        self._upgrade_attempts = 0
        self._changed = asyncio.Event()
        self._server: Server | None = None
        self._failure: BaseException | None = None
        self.socket_link = ""

    async def __aenter__(self) -> Self:
        self._server = await serve(
            self._handle, LOCAL_HOST, 0, process_request=self._process_request, ping_interval=None
        )
        port = self._server.sockets[0].getsockname()[1]
        logging.getLogger(LOGGER_NAME).addHandler(self._log_collector)
        logging.getLogger(LOGGER_NAME).setLevel(logging.INFO)
        self.socket_link = f"ws://{LOCAL_HOST}:{port}/c/secret/connector"
        return self

    async def __aexit__(
        self, error_type: type[BaseException] | None, error: BaseException | None, traceback: TracebackType | None
    ) -> None:
        logging.getLogger(LOGGER_NAME).removeHandler(self._log_collector)
        assert self._server is not None
        self._server.close()
        await self._server.wait_closed()

    @property
    def received_frames(self) -> list[str]:
        return [entry for entry in self.timeline if entry.startswith("{")]

    def wake(self) -> None:
        self._changed.set()

    def logged(self, *, event: str) -> bool:
        return any(f'"event": "{event}"' in line for line in self.logs)

    def record(self, *, entry: str) -> None:
        self.timeline.append(entry)
        self._changed.set()

    def fail(self, *, error: BaseException) -> None:
        self._failure = error
        self._changed.set()

    async def until(self, *, condition: Callable[[], bool]) -> None:
        async with asyncio.timeout(UNTIL_TIMEOUT_SECONDS):
            while not condition():
                if self._failure is not None:
                    raise self._failure
                self._changed.clear()
                await self._changed.wait()

    async def broadcast(self, *, text: str) -> None:
        await asyncio.gather(*(connection.send(text) for connection in self.connections))

    def drop_connections(self) -> None:
        for connection in self.connections:
            connection.transport.abort()

    def _process_request(self, connection: ServerConnection, request: Request) -> Response | None:
        if request.headers.get(UPGRADE_HEADER) is None:
            self.probe_count += 1
            self._changed.set()
            return connection.respond(HTTPStatus(self.probe_status), "")
        self._upgrade_attempts += 1
        if self._upgrade_attempts <= self._refused_upgrades:
            return Response(HTTPStatus.SERVICE_UNAVAILABLE.value, "unavailable", Headers())
        return None

    async def _handle(self, connection: ServerConnection) -> None:
        index = self.open_count
        self.open_count += 1
        self.connections.append(connection)
        self._changed.set()
        try:
            await self._on_open(connection, index)
            async for frame in connection:
                self.record(entry=str(frame))
                await self._answer(connection, str(frame))
        except ConnectionClosed:
            return

    async def _answer(self, connection: ServerConnection, frame: str) -> None:
        if self._answer_pings and frame == PING_TEXT:
            await connection.send(PONG_TEXT)
        if self._on_frame is not None:
            await self._on_frame(connection, frame)
