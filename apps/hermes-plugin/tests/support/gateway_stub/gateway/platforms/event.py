from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from gateway.config import Platform


class MessageType(Enum):
    TEXT = "text"


@dataclass
class SessionSource:
    platform: Platform
    chat_id: str
    chat_name: str | None
    chat_type: str
    user_id: str | None
    user_name: str | None
    message_id: str | None


@dataclass
class MessageEvent:
    text: str
    message_type: MessageType
    source: SessionSource
    message_id: str | None
    raw_message: Any
    timestamp: datetime
