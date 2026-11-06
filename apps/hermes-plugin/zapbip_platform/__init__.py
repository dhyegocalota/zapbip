import os
from typing import Any

from zapbip_platform.adapter import ZapbipAdapter
from zapbip_platform.constants import (
    ALLOWED_USERS_ENV,
    CONNECTION_LINK_ENV,
    PLATFORM_EMOJI,
    PLATFORM_HINT,
    PLATFORM_NAME,
    WHATSAPP_TEXT_MAX_CHARS,
)

ENABLED_EXTRA = {"configured": True}


def is_configured() -> bool:
    return bool(os.environ.get(CONNECTION_LINK_ENV))


def enable_from_environment() -> dict[str, bool] | None:
    if not is_configured():
        return None
    return ENABLED_EXTRA


def register(ctx: Any) -> None:
    ctx.register_platform(
        name=PLATFORM_NAME,
        label=PLATFORM_NAME,
        adapter_factory=ZapbipAdapter,
        check_fn=is_configured,
        validate_config=lambda config: is_configured(),
        required_env=[CONNECTION_LINK_ENV],
        env_enablement_fn=enable_from_environment,
        allowed_users_env=ALLOWED_USERS_ENV,
        max_message_length=WHATSAPP_TEXT_MAX_CHARS,
        emoji=PLATFORM_EMOJI,
        platform_hint=PLATFORM_HINT,
    )
