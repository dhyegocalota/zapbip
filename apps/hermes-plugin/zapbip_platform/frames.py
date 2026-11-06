from dataclasses import dataclass
from typing import Any

from zapbip_platform.constants import FrameRejectionReason


@dataclass(frozen=True)
class ServerFrameParse:
    ok: bool
    frame: dict[str, Any] | None
    reason: FrameRejectionReason | None


def parse_server_frame(*, text: str, is_binary: bool) -> ServerFrameParse:
    raise NotImplementedError("parse_server_frame is not implemented")
