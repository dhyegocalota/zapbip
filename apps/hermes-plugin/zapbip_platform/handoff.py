from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from zapbip_platform.constants import CHANNEL_HANDOFF_NO_TEXT_BY_KIND, MessageKind

MILLISECONDS_PER_SECOND = 1_000

Message = dict[str, Any]


def text_of_text(*, message: Message) -> str:
    return str(message["text"])


def caption_or_no_text(*, message: Message) -> str:
    caption = message["caption"]
    if caption is None:
        return CHANNEL_HANDOFF_NO_TEXT_BY_KIND[message["kind"]]
    return str(caption)


def selected_title_or_no_text(*, message: Message) -> str:
    selected = message["selected"]
    if selected is None:
        return CHANNEL_HANDOFF_NO_TEXT_BY_KIND[message["kind"]]
    return str(selected["title"])


def no_text(*, message: Message) -> str:
    return CHANNEL_HANDOFF_NO_TEXT_BY_KIND[message["kind"]]


HANDOFF_TEXT_BY_KIND: dict[str, Callable[..., str]] = {
    MessageKind.TEXT.value: text_of_text,
    MessageKind.IMAGE.value: caption_or_no_text,
    MessageKind.VIDEO.value: caption_or_no_text,
    MessageKind.DOCUMENT.value: caption_or_no_text,
    MessageKind.CHOICE.value: selected_title_or_no_text,
    MessageKind.AUDIO.value: no_text,
    MessageKind.STICKER.value: no_text,
    MessageKind.LOCATION.value: no_text,
    MessageKind.CONTACTS.value: no_text,
    MessageKind.REACTION.value: no_text,
}


def handoff_text_of(*, message: Message) -> str:
    return HANDOFF_TEXT_BY_KIND[message["kind"]](message=message)


def message_timestamp_of(*, message: Message) -> datetime:
    return datetime.fromtimestamp(message["at"] / MILLISECONDS_PER_SECOND, tz=UTC)
