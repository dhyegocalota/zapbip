from urllib.parse import urlsplit

from zapbip_platform.constants import (
    CONNECTOR_PATH_SUFFIX,
    INVALID_LINK_MESSAGE,
    MCP_PATH_SUFFIX,
    SECURE_LINK_SCHEME,
    SECURE_SOCKET_SCHEME,
)


def socket_link_of(*, connection_link: str) -> str:
    parts = urlsplit(connection_link)
    is_secure_mcp_link = parts.scheme == SECURE_LINK_SCHEME and parts.path.endswith(MCP_PATH_SUFFIX)
    if not is_secure_mcp_link:
        raise ValueError(INVALID_LINK_MESSAGE)
    path = f"{parts.path[: -len(MCP_PATH_SUFFIX)]}{CONNECTOR_PATH_SUFFIX}"
    return parts._replace(scheme=SECURE_SOCKET_SCHEME, path=path).geturl()
