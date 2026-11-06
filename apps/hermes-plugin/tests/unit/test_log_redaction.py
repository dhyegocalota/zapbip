import io
import logging
import sys
from collections.abc import Iterator

import pytest

from zapbip_platform.log import REDACTED_LOGGER_NAMES

HTTP_CLIENT_LOGGER_NAMES = ["httpx", "httpx2", "websockets.client"]
SECRET = "zb_conn_" + "c" * 43
SECRET_LINK = f"https://zapbip.example/c/{SECRET}/connector"


@pytest.fixture
def captured_output() -> Iterator[io.StringIO]:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger = logging.getLogger(REDACTED_LOGGER_NAMES[0])
    logger.addHandler(handler)
    yield stream
    logger.removeHandler(handler)


def test_the_message_and_its_arguments_are_redacted(captured_output: io.StringIO) -> None:
    logging.getLogger(REDACTED_LOGGER_NAMES[0]).warning("GET %s", SECRET_LINK)

    assert SECRET not in captured_output.getvalue()
    assert "/c/redacted/" in captured_output.getvalue()


def test_the_traceback_is_redacted(captured_output: io.StringIO) -> None:
    try:
        raise RuntimeError(f"cannot reach {SECRET_LINK}")
    except RuntimeError:
        logging.getLogger(REDACTED_LOGGER_NAMES[0]).error("failed", exc_info=sys.exc_info())

    assert SECRET not in captured_output.getvalue()
    assert "cannot reach" in captured_output.getvalue()


def test_the_stack_info_is_redacted(captured_output: io.StringIO) -> None:
    logging.getLogger(REDACTED_LOGGER_NAMES[0]).error("stack", stack_info=True, extra={"link": "/c/zb_conn_cccccccccccccccccccccccccccccccccccccccccc/"})

    assert "zb_conn_cccccccccccccccccccccccccccccccccccccccccc" not in captured_output.getvalue()
    assert "test_the_stack_info_is_redacted" in captured_output.getvalue()


@pytest.mark.parametrize("logger_name", HTTP_CLIENT_LOGGER_NAMES)
def test_every_http_client_logger_redacts_the_secret_path(logger_name: str) -> None:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    logging.getLogger(logger_name).addHandler(handler)
    logging.getLogger(logger_name).setLevel(logging.INFO)

    logging.getLogger(logger_name).info('HTTP Request: POST %s "HTTP/1.1 200 OK"', SECRET_LINK)

    logging.getLogger(logger_name).removeHandler(handler)
    assert SECRET not in stream.getvalue()
    assert "/c/redacted/" in stream.getvalue()
