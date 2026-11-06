from enum import Enum

HEARTBEAT_INTERVAL_MS = 25_000
HEARTBEAT_TIMEOUT_MS = 10_000
RECONNECT_BASE_MS = 1_000
RECONNECT_MAX_MS = 30_000
REPLACED_CLOSE_CODE = 4001
UPGRADE_REQUIRED_STATUS = 426
UNAUTHORIZED_STATUS = 401
CONNECTOR_FRAME_MAX_BYTES = 65_536
CONNECTOR_PATH_SUFFIX = "/connector"
MCP_PATH_SUFFIX = "/mcp"
SECURE_LINK_SCHEME = "https"
SECURE_SOCKET_SCHEME = "wss"
CONNECTOR_PING_TEXT = '{"type":"ping"}'
CONNECTOR_PONG_TEXT = '{"type":"pong"}'
CHANNEL_FORWARDED_PREFIX = "[forwarded — not written by the owner]"
CHANNEL_PLUGIN_SELF_TEST_TEXT = "✅ instalado"
SEEN_MESSAGE_LIMIT = 1_024
ABNORMAL_CLOSE_CODE = 1006
NORMAL_CLOSE_CODE = 1000
FAILURE_EXIT_CODE = 1
CLEAN_EXIT_CODE = 0
MILLISECONDS_PER_SECOND = 1_000
CONNECTION_LINK_ENV = "ZAPBIP_CONNECTION_LINK"
ALLOWED_USERS_ENV = "ZAPBIP_ALLOWED_USERS"
PLUGIN_NAME = "zapbip-platform"
PLATFORM_NAME = "zapbip"
PLUGIN_VERSION = "0.1.0"
OWNER_CHAT_ID = "owner"
OWNER_CHAT_TYPE = "dm"
WHATSAPP_TEXT_MAX_CHARS = 4_096
SEND_MESSAGE_TOOL_NAME = "send_message"
MCP_PROTOCOL_VERSION = "2025-06-18"
MCP_REQUEST_TIMEOUT_SECONDS = 15.0
INVALID_LINK_MESSAGE = f"{CONNECTION_LINK_ENV} must be an https link ending in {MCP_PATH_SUFFIX}"
PLATFORM_HINT = "You are chatting with the owner through zapbip (WhatsApp). Plain text only."
PLATFORM_EMOJI = "💬"

CHANNEL_HANDOFF_NO_TEXT_BY_KIND: dict[str, str] = {
    "text": "The owner sent a message with no text.",
    "image": "The owner sent an image without a caption.",
    "video": "The owner sent a video without a caption.",
    "audio": "The owner sent an audio message.",
    "document": "The owner sent a document without a caption.",
    "sticker": "The owner sent a sticker.",
    "location": "The owner sent a location.",
    "contacts": "The owner sent a contact card.",
    "reaction": "The owner reacted to a message.",
    "choice": "The owner sent a reply with no option selected.",
}


class MessageKind(Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    STICKER = "sticker"
    LOCATION = "location"
    CONTACTS = "contacts"
    REACTION = "reaction"
    CHOICE = "choice"


class ConnectorFrameType(Enum):
    HELLO = "hello"
    MESSAGES = "messages"
    DONE = "done"
    PING = "ping"
    PONG = "pong"


class FrameRejectionReason(Enum):
    BINARY_FRAME = "binary_frame"
    FRAME_TOO_LARGE = "frame_too_large"
    MALFORMED = "malformed"
    UNKNOWN_TYPE = "unknown_type"


class ConnectorLogEvent(Enum):
    CONNECTOR_CONNECTED = "connector_connected"
    CONNECTOR_RECONNECTING = "connector_reconnecting"
    CONNECTOR_CLOSED = "connector_closed"
    CONNECTOR_REPLACED = "connector_replaced"
    MESSAGES_RECEIVED = "messages_received"
    DONE_SENT = "done_sent"
    FRAME_REJECTED = "frame_rejected"


class PluginLogEvent(Enum):
    PROBE_FAILED = "probe_failed"
    HANDOFF_FAILED = "plugin_handoff_failed"
