import json
import logging
import re

from .constants import ConnectorLogEvent, PluginLogEvent

logger = logging.getLogger("zapbip_platform")
REDACTED_LOGGER_NAMES = ("httpx", "httpx2", "websockets.client")
SECRET_PATH_PATTERN = re.compile(r"/c/[^/\s\"']+/")
REDACTED_PATH = "/c/redacted/"


def redacted(*, text: str) -> str:
    return SECRET_PATH_PATTERN.sub(REDACTED_PATH, text)


class SecretPathRedaction(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redacted(text=record.getMessage())
        record.args = None
        if record.exc_info:
            record.exc_text = redacted(text=logging.Formatter().formatException(record.exc_info))
        if record.stack_info:
            record.stack_info = redacted(text=record.stack_info)
        return True


for redacted_logger_name in REDACTED_LOGGER_NAMES:
    logging.getLogger(redacted_logger_name).addFilter(SecretPathRedaction())


def redact_root_handlers() -> None:
    raise NotImplementedError("redact_root_handlers is not implemented")


def log_connector_event(*, event: ConnectorLogEvent | PluginLogEvent, **fields: str | int | bool | None) -> None:
    logger.info(json.dumps({"event": event.value, **fields}))
