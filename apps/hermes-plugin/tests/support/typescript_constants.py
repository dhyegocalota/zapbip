import re
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
CONNECTOR_SOURCE = REPOSITORY_ROOT / "libs/types/src/connector.ts"
ENUMS_SOURCE = REPOSITORY_ROOT / "libs/types/src/enums.ts"
CHANNEL_PLUGIN_SOURCE = REPOSITORY_ROOT / "libs/types/src/channel-plugin.ts"
INBOX_CONSTANTS_SOURCE = REPOSITORY_ROOT / "libs/core/src/inbox/constants.ts"
TOOL_DEFINITIONS_SOURCE = REPOSITORY_ROOT / "apps/api/src/contract/tool-definitions.ts"

ENUM_PATTERN = r"export enum {name} \{{(.*?)\}}"
MEMBER_PATTERN = re.compile(r"(\w+) = '([^']*)'")
CONSTANT_PATTERN = r"export const {name}(?::[^=]+)? = ([^;]+);"
NUMBER_PATTERN = re.compile(r"^[\d_]+$")
TEXT_BY_KIND_PATTERN = re.compile(r"\[MessageKind\.(\w+)\]: '([^']*)'")


def enum_members_of(*, source: Path, name: str) -> dict[str, str]:
    body = re.search(ENUM_PATTERN.format(name=name), source.read_text(), re.DOTALL)
    assert body is not None, f"enum {name} not found in {source}"
    return dict(MEMBER_PATTERN.findall(body.group(1)))


def constant_of(*, source: Path, name: str) -> int | str:
    match = re.search(CONSTANT_PATTERN.format(name=name), source.read_text())
    assert match is not None, f"constant {name} not found in {source}"
    literal = match.group(1).strip()
    if NUMBER_PATTERN.match(literal):
        return int(literal.replace("_", ""))
    return literal.strip("'")


def no_text_by_kind() -> dict[str, str]:
    kinds = enum_members_of(source=ENUMS_SOURCE, name="MessageKind")
    return {kinds[member]: text for member, text in TEXT_BY_KIND_PATTERN.findall(CHANNEL_PLUGIN_SOURCE.read_text())}
