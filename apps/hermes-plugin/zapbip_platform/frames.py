import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from .constants import CONNECTOR_FRAME_MAX_BYTES, ConnectorFrameType, FrameRejectionReason, MessageKind

FrameBody = dict[str, Any]


@dataclass(frozen=True)
class ServerFrameParse:
    ok: bool
    frame: FrameBody | None
    reason: FrameRejectionReason | None


def is_valid_hello(*, body: FrameBody) -> bool:
    return isinstance(body.get("agent"), str) and isinstance(body.get("previousWakeMode"), str)


MESSAGE_KINDS = {kind.value for kind in MessageKind}


def is_known_message(*, message: Any) -> bool:
    return (
        isinstance(message, dict)
        and isinstance(message.get("messageId"), str)
        and isinstance(message.get("kind"), str)
        and message["kind"] in MESSAGE_KINDS
    )


def is_valid_messages(*, body: FrameBody) -> bool:
    messages = body.get("messages")
    return isinstance(messages, list) and all(is_known_message(message=message) for message in messages)


def is_valid_pong(*, body: FrameBody) -> bool:
    return True


FRAME_VALIDATORS: dict[str, Callable[..., bool]] = {
    ConnectorFrameType.HELLO.value: is_valid_hello,
    ConnectorFrameType.MESSAGES.value: is_valid_messages,
    ConnectorFrameType.PONG.value: is_valid_pong,
}


def rejected(*, reason: FrameRejectionReason) -> ServerFrameParse:
    return ServerFrameParse(ok=False, frame=None, reason=reason)


def load_body(*, text: str) -> FrameBody | None:
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(body, dict):
        return None
    return body


def parse_server_frame(*, text: str, is_binary: bool) -> ServerFrameParse:
    if is_binary:
        return rejected(reason=FrameRejectionReason.BINARY_FRAME)
    if len(text.encode()) > CONNECTOR_FRAME_MAX_BYTES:
        return rejected(reason=FrameRejectionReason.FRAME_TOO_LARGE)
    body = load_body(text=text)
    if body is None:
        return rejected(reason=FrameRejectionReason.MALFORMED)
    validate = FRAME_VALIDATORS.get(str(body.get("type")))
    if validate is None:
        return rejected(reason=FrameRejectionReason.UNKNOWN_TYPE)
    if not validate(body=body):
        return rejected(reason=FrameRejectionReason.MALFORMED)
    return ServerFrameParse(ok=True, frame=body, reason=None)
