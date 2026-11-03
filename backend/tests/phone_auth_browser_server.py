"""Local-only browser test server. Imports testenv to force a temporary synthetic DB."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import testenv  # noqa: E402, F401
from test_phone_auth import FakeVerify  # noqa: E402
from backend.app import config, phone_provider  # noqa: E402
from backend.app.main import app  # noqa: E402
import uvicorn  # noqa: E402

if __name__ == "__main__":
    provider = FakeVerify()
    phone_provider.configured = lambda: True
    config.PHONE_OTP_COOLDOWN_SECONDS = 1  # speed up the UI test only; production remains 60 seconds
    app.dependency_overrides[phone_provider.get_provider] = lambda: provider
    uvicorn.run(app, host="127.0.0.1", port=8003)
