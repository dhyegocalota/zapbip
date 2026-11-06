from datetime import datetime
from typing import Any


def handoff_text_of(*, message: dict[str, Any]) -> str:
    raise NotImplementedError("handoff_text_of is not implemented")


def message_timestamp_of(*, message: dict[str, Any]) -> datetime:
    raise NotImplementedError("message_timestamp_of is not implemented")
