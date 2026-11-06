import json

import pytest
from frame_builders import hello_text, messages_text, text_message

from zapbip_platform.constants import CONNECTOR_FRAME_MAX_BYTES, CONNECTOR_PONG_TEXT, FrameRejectionReason
from zapbip_platform.frames import parse_server_frame


def test_parses_hello() -> None:
    parsed = parse_server_frame(text=hello_text(), is_binary=False)

    assert parsed.ok
    assert parsed.frame is not None
    assert parsed.frame["type"] == "hello"


def test_hello_without_agent() -> None:
    text = json.dumps({"type": "hello", "previousWakeMode": "none"})

    parsed = parse_server_frame(text=text, is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.MALFORMED


def test_hello_with_null_wake_mode() -> None:
    text = json.dumps({"type": "hello", "agent": "alpha", "previousWakeMode": None})

    parsed = parse_server_frame(text=text, is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.MALFORMED


def test_parses_messages() -> None:
    text = messages_text(messages=[text_message(message_id="msg_1", text="oi")])

    parsed = parse_server_frame(text=text, is_binary=False)

    assert parsed.ok
    assert parsed.frame is not None
    assert parsed.frame["messages"][0]["messageId"] == "msg_1"


def test_empty_messages_is_valid() -> None:
    parsed = parse_server_frame(text=messages_text(messages=[]), is_binary=False)

    assert parsed.ok
    assert parsed.frame is not None
    assert parsed.frame["messages"] == []


def test_message_without_id() -> None:
    text = json.dumps({"type": "messages", "messages": [{"kind": "text", "text": "oi"}]})

    parsed = parse_server_frame(text=text, is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.MALFORMED


@pytest.mark.parametrize("kind", [None, "zzz", "constructor", 3, "__class__"])
def test_message_with_an_unknown_kind_is_malformed(kind: object) -> None:
    text = json.dumps({"type": "messages", "messages": [{"messageId": "msg_1", "kind": kind}]})

    parsed = parse_server_frame(text=text, is_binary=False)

    assert parsed.ok is False
    assert parsed.reason == FrameRejectionReason.MALFORMED


def test_message_without_a_kind_is_malformed() -> None:
    text = json.dumps({"type": "messages", "messages": [{"messageId": "msg_1"}]})

    parsed = parse_server_frame(text=text, is_binary=False)

    assert parsed.reason == FrameRejectionReason.MALFORMED


def test_server_never_sends_done() -> None:
    text = json.dumps({"type": "done", "messageId": "msg_1"})

    parsed = parse_server_frame(text=text, is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.UNKNOWN_TYPE


def test_type_is_case_sensitive() -> None:
    text = json.dumps({"type": "HELLO", "agent": "alpha", "previousWakeMode": "none"})

    parsed = parse_server_frame(text=text, is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.UNKNOWN_TYPE


def test_pong_is_accepted_without_rejection() -> None:
    parsed = parse_server_frame(text=CONNECTOR_PONG_TEXT, is_binary=False)

    assert parsed.ok
    assert parsed.reason is None
    assert parsed.frame == {"type": "pong"}


def test_binary_frame() -> None:
    parsed = parse_server_frame(text="", is_binary=True)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.BINARY_FRAME


def padded_messages_text(*, byte_length: int) -> str:
    empty_length = len(messages_text(messages=[text_message(message_id="msg_1", text="")]).encode())
    padding = "a" * (byte_length - empty_length)
    return messages_text(messages=[text_message(message_id="msg_1", text=padding)])


def test_frame_at_the_size_limit() -> None:
    text = padded_messages_text(byte_length=CONNECTOR_FRAME_MAX_BYTES)
    assert len(text.encode()) == CONNECTOR_FRAME_MAX_BYTES

    parsed = parse_server_frame(text=text, is_binary=False)

    assert parsed.ok


def test_frame_over_the_size_limit() -> None:
    text = padded_messages_text(byte_length=CONNECTOR_FRAME_MAX_BYTES + 1)

    parsed = parse_server_frame(text=text, is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.FRAME_TOO_LARGE


def test_not_json() -> None:
    parsed = parse_server_frame(text="not json", is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.MALFORMED


def test_json_array() -> None:
    parsed = parse_server_frame(text="[]", is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.MALFORMED


def test_json_null() -> None:
    parsed = parse_server_frame(text="null", is_binary=False)

    assert not parsed.ok
    assert parsed.reason == FrameRejectionReason.MALFORMED


def test_unicode_text_is_byte_identical() -> None:
    text = messages_text(messages=[text_message(message_id="msg_1", text="✅ oi 😉 çã")])

    parsed = parse_server_frame(text=text, is_binary=False)

    assert parsed.frame is not None
    assert parsed.frame["messages"][0]["text"] == "✅ oi 😉 çã"
