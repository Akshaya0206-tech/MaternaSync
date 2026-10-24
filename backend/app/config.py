import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.environ.get("MATERNASYNC_DATABASE_URL", f"sqlite:///{BASE_DIR / 'maternasync.db'}")
DEMO_ENABLED = os.environ.get("MATERNASYNC_DEMO_ENABLED", "true").lower() == "true"
UPLOAD_DIR = Path(os.environ.get("MATERNASYNC_UPLOAD_DIR", str(BASE_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
# Handover is on hold while its rules and the way it works are refined: nothing can be generated, edited or shared.
# Existing drafts stay readable. Set MATERNASYNC_HANDOVER_PAUSED=false to switch it back on.
HANDOVER_PAUSED = os.environ.get("MATERNASYNC_HANDOVER_PAUSED", "true").lower() == "true"
HANDOVER_PAUSED_MESSAGE = ("Handover is paused while its rules and the way it works are being refined. "
                           "It cannot be generated, edited or shared right now. Earlier drafts can still be read.")

# Prototype-only secret. In a real deployment this must come from a secrets
# manager / environment variable and never be committed.
JWT_SECRET = os.environ.get("MATERNASYNC_JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = 60 * 24 * 7  # 7 days
