import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.environ.get("MATERNASYNC_DATABASE_URL", f"sqlite:///{BASE_DIR / 'maternasync.db'}")
DEMO_ENABLED = os.environ.get("MATERNASYNC_DEMO_ENABLED", "true").lower() == "true"
UPLOAD_DIR = Path(os.environ.get("MATERNASYNC_UPLOAD_DIR", str(BASE_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Prototype-only secret. In a real deployment this must come from a secrets
# manager / environment variable and never be committed.
JWT_SECRET = os.environ.get("MATERNASYNC_JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = 60 * 24 * 7  # 7 days
