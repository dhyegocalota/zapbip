import pytest

from zapbip_platform.connection_link import socket_link_of

SECRET = "zb_conn_" + "a" * 43


def test_derives_the_secure_socket_link() -> None:
    link = socket_link_of(connection_link=f"https://zapbip.example/c/{SECRET}/mcp")

    assert link == f"wss://zapbip.example/c/{SECRET}/connector"


@pytest.mark.parametrize(
    "connection_link",
    [f"http://zapbip.example/c/{SECRET}/mcp", f"https://zapbip.example/c/{SECRET}/other", "not a link", ""],
)
def test_refuses_a_link_that_is_not_a_secure_mcp_link(connection_link: str) -> None:
    with pytest.raises(ValueError) as refusal:
        socket_link_of(connection_link=connection_link)

    assert SECRET not in str(refusal.value)
