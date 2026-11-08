import ast
import operator
import re
from collections.abc import Callable
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
CONNECTOR_SOURCE = REPOSITORY_ROOT / "libs/types/src/connector.ts"
ENUMS_SOURCE = REPOSITORY_ROOT / "libs/types/src/enums.ts"
CHANNEL_PLUGIN_SOURCE = REPOSITORY_ROOT / "libs/types/src/channel-plugin.ts"
HERMES_PLUGIN_SOURCE = REPOSITORY_ROOT / "libs/agents/supported/hermes/plugin.ts"
SHARED_CONSTANTS_SOURCE = REPOSITORY_ROOT / "libs/types/src/constants.ts"
INBOX_CONSTANTS_SOURCE = REPOSITORY_ROOT / "libs/core/src/inbox/constants.ts"

ENUM_PATTERN = r"export enum {name} \{{(.*?)\}}"
MEMBER_PATTERN = re.compile(r"(\w+) = '([^']*)'")
CONSTANT_PATTERN = r"export const {name}(?::[^=]+)? = ([^;]+);"
NUMBER_PATTERN = re.compile(r"^[\d_]+$")
EXPRESSION_PATTERN = re.compile(r"^[\w\s*+()]+$")
IDENTIFIER_PATTERN = re.compile(r"[A-Z][A-Z_]+")
OPERATORS: dict[type[ast.operator], Callable[[int, int], int]] = {ast.Mult: operator.mul, ast.Add: operator.add}
NUMERIC_MEMBER_PATTERN = re.compile(r"(\w+) = (\d+)")
TEXT_BY_KIND_PATTERN = re.compile(r"\[MessageKind\.(\w+)\]: '([^']*)'")


def enum_members_of(*, source: Path, name: str) -> dict[str, str]:
    body = re.search(ENUM_PATTERN.format(name=name), source.read_text(), re.DOTALL)
    assert body is not None, f"enum {name} not found in {source}"
    return dict(MEMBER_PATTERN.findall(body.group(1)))


def numeric_enum_member_of(*, source: Path, enum_name: str, member: str) -> int:
    body = re.search(ENUM_PATTERN.format(name=enum_name), source.read_text(), re.DOTALL)
    assert body is not None, f"enum {enum_name} not found in {source}"
    return int(dict(NUMERIC_MEMBER_PATTERN.findall(body.group(1)))[member])


def constant_of(*, source: Path, name: str) -> int | str:
    match = re.search(CONSTANT_PATTERN.format(name=name), source.read_text())
    assert match is not None, f"constant {name} not found in {source}"
    literal = match.group(1).strip()
    if NUMBER_PATTERN.match(literal):
        return int(literal.replace("_", ""))
    if EXPRESSION_PATTERN.match(literal):
        return evaluate_expression(expression=ast.parse(resolve_identifiers(literal=literal), mode="eval").body)
    return literal.strip("'")


def resolve_identifiers(*, literal: str) -> str:
    return IDENTIFIER_PATTERN.sub(lambda match: str(constant_of(source=SHARED_CONSTANTS_SOURCE, name=match.group(0))), literal).replace("_", "")


def evaluate_expression(*, expression: ast.expr) -> int:
    if isinstance(expression, ast.Constant):
        assert isinstance(expression.value, int), f"unsupported constant {ast.dump(expression)}"
        return expression.value
    assert isinstance(expression, ast.BinOp), f"unsupported expression {ast.dump(expression)}"
    return OPERATORS[type(expression.op)](
        evaluate_expression(expression=expression.left), evaluate_expression(expression=expression.right)
    )


def no_text_by_kind() -> dict[str, str]:
    kinds = enum_members_of(source=ENUMS_SOURCE, name="MessageKind")
    return {kinds[member]: text for member, text in TEXT_BY_KIND_PATTERN.findall(CHANNEL_PLUGIN_SOURCE.read_text())}
