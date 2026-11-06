import json
from typing import Any

MESSAGE_AT = 1_700_000_000_000


def text_message(*, message_id: str, text: str) -> dict[str, Any]:
    return {"messageId": message_id, "kind": "text", "text": text, "at": MESSAGE_AT, "forwarded": False}


def hello_text(*, agent: str = "alpha", previous_wake_mode: str = "none") -> str:
    return json.dumps({"type": "hello", "agent": agent, "previousWakeMode": previous_wake_mode})


def messages_text(*, messages: list[dict[str, Any]]) -> str:
    return json.dumps({"type": "messages", "messages": messages})
