import json
import logging

from zapbip_platform.constants import ConnectorLogEvent, PluginLogEvent

logger = logging.getLogger("zapbip_platform")


def log_connector_event(*, event: ConnectorLogEvent | PluginLogEvent, **fields: str | int | bool | None) -> None:
    logger.info(json.dumps({"event": event.value, **fields}))
