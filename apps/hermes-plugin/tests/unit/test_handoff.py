from datetime import UTC, datetime
from typing import Any

import pytest

from zapbip_platform.constants import CHANNEL_HANDOFF_NO_TEXT_BY_KIND
from zapbip_platform.handoff import handoff_text_of, message_timestamp_of

MESSAGE_AT = 1_700_000_000_000


def test_text_is_the_text() -> None:
    assert handoff_text_of(message={"kind": "text", "text": "oi"}) == "oi"


def test_image_with_caption() -> None:
    assert handoff_text_of(message={"kind": "image", "caption": "foto"}) == "foto"


def test_image_without_caption() -> None:
    text = handoff_text_of(message={"kind": "image", "caption": None})

    assert text == CHANNEL_HANDOFF_NO_TEXT_BY_KIND["image"]


@pytest.mark.parametrize("kind", ["video", "audio", "document", "sticker", "location", "contacts", "reaction"])
def test_each_kind_without_text(kind: str) -> None:
    message: dict[str, Any] = {"kind": kind, "caption": None}

    assert handoff_text_of(message=message) == CHANNEL_HANDOFF_NO_TEXT_BY_KIND[kind]


def test_choice_uses_selected_title() -> None:
    message = {"kind": "choice", "selected": {"title": "Sim"}}

    assert handoff_text_of(message=message) == "Sim"


def test_choice_without_selection() -> None:
    message = {"kind": "choice", "selected": None}

    assert handoff_text_of(message=message) == CHANNEL_HANDOFF_NO_TEXT_BY_KIND["choice"]


def test_empty_text_is_handed_off_as_is() -> None:
    assert handoff_text_of(message={"kind": "text", "text": ""}) == ""


def test_timestamp_is_timezone_aware_utc() -> None:
    timestamp = message_timestamp_of(message={"at": MESSAGE_AT})

    assert timestamp == datetime(2023, 11, 14, 22, 13, 20, tzinfo=UTC)
    assert timestamp.isoformat() == "2023-11-14T22:13:20+00:00"
