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

def _flag(name: str, default: str) -> bool:
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


# The care-team sign-in is switched off: the care assistant and the doctor do that work, and a trusted family member
# has a caregiver login. All the care-team code stays in place. Set MATERNASYNC_CARE_TEAM_ENABLED=true to bring it back.
CARE_TEAM_ENABLED = _flag("MATERNASYNC_CARE_TEAM_ENABLED", "false")
CARE_TEAM_OFF_MESSAGE = ("The care-team sign-in is switched off. The clinic's care assistant and your doctor now do that work. "
                         "A trusted family member can use a caregiver login instead.")

# The care assistant (see ai workflow.md). Modes: "off" does nothing; "shadow" only records what it would have done;
# "assist" lets it do low-risk administrative steps and turns everything else into a proposal a doctor approves.
# There is deliberately no "auto" mode yet.
AI_COORDINATOR_MODE = os.environ.get("MATERNASYNC_AI_COORDINATOR_MODE", "assist").strip().lower()
if AI_COORDINATOR_MODE not in ("off", "shadow", "assist"):
    AI_COORDINATOR_MODE = "off"  # an unknown value must never switch the assistant on
# "rules" decides with ordinary code and needs no network or key. "claude" asks the Claude API for the classification
# steps (it needs ANTHROPIC_API_KEY, and sends the minimum text to a third party; see ai workflow.md section 6.5).
AI_PROVIDER = os.environ.get("MATERNASYNC_AI_PROVIDER", "rules").strip().lower()
AI_MODEL = os.environ.get("MATERNASYNC_AI_MODEL", "claude-opus-5-5").strip()  # claude-haiku-5-5 is the cheaper choice for these short steps
AI_WORKER = _flag("MATERNASYNC_AI_WORKER", "true")  # the background job that processes queued assistant work
AI_DAILY_ACTION_CAP = int(os.environ.get("MATERNASYNC_AI_DAILY_CAP", "40"))  # most assistant actions per patient per day

# Prototype-only secret. In a real deployment this must come from a secrets
# manager / environment variable and never be committed.
JWT_SECRET = os.environ.get("MATERNASYNC_JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = 60 * 24 * 7  # 7 days
