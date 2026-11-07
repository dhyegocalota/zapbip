import sys
from pathlib import Path

SUPPORT_DIRECTORY = Path(__file__).resolve().parent.parent / "support"
GATEWAY_STUB_DIRECTORY = SUPPORT_DIRECTORY / "gateway_stub"

for directory in (SUPPORT_DIRECTORY, GATEWAY_STUB_DIRECTORY):
    sys.path.insert(0, str(directory))
