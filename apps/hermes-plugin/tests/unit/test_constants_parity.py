import json
from enum import Enum

import pytest
from typescript_constants import (
    CHANNEL_PLUGIN_SOURCE,
    CONNECTOR_SOURCE,
    ENUMS_SOURCE,
    INBOX_CONSTANTS_SOURCE,
    SHARED_CONSTANTS_SOURCE,
    TOOL_DEFINITIONS_SOURCE,
    constant_of,
    enum_members_of,
    no_text_by_kind,
)

from zapbip_platform import constants
from zapbip_platform.constants import (
    CHANNEL_HANDOFF_NO_TEXT_BY_KIND,
    ConnectorFrameType,
    ConnectorLogEvent,
    FrameRejectionReason,
    MessageKind,
    PluginLogEvent,
)

CONNECTOR_CONSTANT_NAMES = [
    "HEARTBEAT_INTERVAL_MS",
    "HEARTBEAT_TIMEOUT_MS",
    "RECONNECT_BASE_MS",
    "RECONNECT_MAX_MS",
    "REPLACED_CLOSE_CODE",
    "UPGRADE_REQUIRED_STATUS",
    "UNAUTHORIZED_STATUS",
    "CONNECTOR_FRAME_MAX_BYTES",
    "CONNECTOR_PATH_SUFFIX",
    "MCP_PATH_SUFFIX",
]


def values_of(*, enum: type[Enum]) -> set[str]:
    return {str(member.value) for member in enum}


@pytest.mark.parametrize("name", CONNECTOR_CONSTANT_NAMES)
def test_connector_constants_equal_the_shared_ones(name: str) -> None:
    assert getattr(constants, name) == constant_of(source=CONNECTOR_SOURCE, name=name)


def test_ping_and_pong_texts_equal_the_shared_ones() -> None:
    ping = json.dumps({"type": enum_members_of(source=CONNECTOR_SOURCE, name="ConnectorFrameType")["Ping"]}, separators=(",", ":"))
    pong = json.dumps({"type": enum_members_of(source=CONNECTOR_SOURCE, name="ConnectorFrameType")["Pong"]}, separators=(",", ":"))

    assert constants.CONNECTOR_PING_TEXT == ping
    assert constants.CONNECTOR_PONG_TEXT == pong


def test_frame_types_equal_the_shared_ones() -> None:
    shared = set(enum_members_of(source=CONNECTOR_SOURCE, name="ConnectorFrameType").values())

    assert values_of(enum=ConnectorFrameType) == shared


def test_rejection_reasons_equal_the_shared_ones() -> None:
    shared = set(enum_members_of(source=CONNECTOR_SOURCE, name="FrameRejectionReason").values())

    assert values_of(enum=FrameRejectionReason) == shared


def test_connector_log_events_are_a_subset_of_the_shared_ones() -> None:
    shared = set(enum_members_of(source=CONNECTOR_SOURCE, name="ConnectorLogEvent").values())

    assert values_of(enum=ConnectorLogEvent) <= shared


def test_message_kinds_equal_the_shared_ones() -> None:
    shared = set(enum_members_of(source=ENUMS_SOURCE, name="MessageKind").values())

    assert values_of(enum=MessageKind) == shared


def test_no_text_handoff_sentences_equal_the_shared_ones() -> None:
    assert CHANNEL_HANDOFF_NO_TEXT_BY_KIND == no_text_by_kind()


def test_self_test_text_equals_the_shared_one() -> None:
    assert constants.CHANNEL_PLUGIN_SELF_TEST_TEXT == constant_of(source=CHANNEL_PLUGIN_SOURCE, name="CHANNEL_PLUGIN_SELF_TEST_TEXT")


def test_plugin_name_equals_the_shared_package_name() -> None:
    assert f"'{constants.PLUGIN_NAME}'" in CHANNEL_PLUGIN_SOURCE.read_text()


def test_text_limit_equals_the_core_limit() -> None:
    assert constants.WHATSAPP_TEXT_MAX_CHARS == constant_of(source=INBOX_CONSTANTS_SOURCE, name="WHATSAPP_TEXT_MAX_CHARS")


def test_send_message_tool_name_equals_the_api_tool_name() -> None:
    tool_names = enum_members_of(source=TOOL_DEFINITIONS_SOURCE, name="McpToolName")

    assert constants.SEND_MESSAGE_TOOL_NAME == tool_names["SendMessage"]


def test_seen_message_limit_equals_the_shared_one() -> None:
    assert constants.SEEN_MESSAGE_LIMIT == constant_of(source=SHARED_CONSTANTS_SOURCE, name="SEEN_MESSAGE_LIMIT")


def test_handoff_failed_event_equals_the_shared_one() -> None:
    shared = enum_members_of(source=CONNECTOR_SOURCE, name="ConnectorLogEvent")["PluginHandoffFailed"]

    assert PluginLogEvent.HANDOFF_FAILED.value == shared


def test_forwarded_prefix_equals_the_shared_one() -> None:
    assert constants.CHANNEL_FORWARDED_PREFIX == constant_of(source=CHANNEL_PLUGIN_SOURCE, name="CHANNEL_FORWARDED_PREFIX")
