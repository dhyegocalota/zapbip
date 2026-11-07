from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Platform:
    value: str


@dataclass
class PlatformConfig:
    enabled: bool = True
    extra: dict[str, Any] = field(default_factory=dict)
