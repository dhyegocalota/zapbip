from zapbip_platform.constants import (
    CHANNEL_HANDOFF_NO_TEXT_BY_KIND,
    CHANNEL_PLUGIN_SELF_TEST_TEXT,
    CONNECTOR_FRAME_MAX_BYTES,
    CONNECTOR_PING_TEXT,
    REPLACED_CLOSE_CODE,
    UPGRADE_REQUIRED_STATUS,
    ConnectorFrameType,
)


def test_connector_limits_match_the_shared_values() -> None:
    assert CONNECTOR_FRAME_MAX_BYTES == 65_536
    assert UPGRADE_REQUIRED_STATUS == 426
    assert REPLACED_CLOSE_CODE == 4001


def test_wire_strings_match_the_shared_values() -> None:
    assert CONNECTOR_PING_TEXT == '{"type":"ping"}'
    assert ConnectorFrameType.HELLO.value == "hello"
    assert CHANNEL_PLUGIN_SELF_TEST_TEXT == "✅ instalado"
    assert len(CHANNEL_HANDOFF_NO_TEXT_BY_KIND) == 10
