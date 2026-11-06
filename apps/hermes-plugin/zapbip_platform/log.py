import json
import logging
import re

from .constants import ConnectorLogEvent, PluginLogEvent

logger = logging.getLogger("zapbip_platform")
REDACTED_LOGGER_NAMES = ("httpx", "websockets.client")
SECRET_PATH_PATTERN = re.compile(r"/c/[^/\s\"']+/")
REDACTED_PATH = "/c/redacted/"


class SecretPathRedaction(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = SECRET_PATH_PATTERN.sub(REDACTED_PATH, record.getMessage())
        record.args = None
        return True


for redacted_logger_name in REDACTED_LOGGER_NAMES:
    logging.getLogger(redacted_logger_name).addFilter(SecretPathRedaction())


def log_connector_event(*, event: ConnectorLogEvent | PluginLogEvent, **fields: str | int | bool | None) -> None:
    logger.info(json.dumps({"event": event.value, **fields}))
