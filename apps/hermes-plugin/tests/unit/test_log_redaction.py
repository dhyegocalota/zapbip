import io
import logging
import sys
from collections.abc import Iterator

import pytest

from zapbip_platform.log import REDACTED_LOGGER_NAMES

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
