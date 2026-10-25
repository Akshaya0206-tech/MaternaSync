"""Shared setup for the test modules: one isolated synthetic database and upload folder for the whole run.

Import this before anything from `backend.app`. The settings are read when the app is first imported, so the first test
module to load decides them for every module in the same run.
"""
import atexit
import os
import tempfile

temp = tempfile.TemporaryDirectory(prefix="maternasync-test-", ignore_cleanup_errors=True)
os.environ["MATERNASYNC_DATABASE_URL"] = "sqlite:///" + temp.name.replace("\\", "/") + "/test.db"
os.environ["MATERNASYNC_UPLOAD_DIR"] = temp.name + "/uploads"
os.environ["MATERNASYNC_DEMO_ENABLED"] = "true"
# The care-team portal is switched off by default but kept in the code, and the older tests still cover it, so they run with it on.
# The caregiver tests turn it off for the cases that need it off.
os.environ["MATERNASYNC_CARE_TEAM_ENABLED"] = "true"
os.environ["MATERNASYNC_AI_COORDINATOR_MODE"] = "assist"
# The frontend on another host (Vercel) is allowed by address, and its preview addresses by pattern.
os.environ["MATERNASYNC_CORS_ORIGINS"] = "https://maternasync-test.vercel.app/, *"
os.environ["MATERNASYNC_CORS_ORIGIN_REGEX"] = r"^https://maternasync-[a-z0-9-]+-preview\.vercel\.app$"
os.environ["MATERNASYNC_SEMANTIC_SEARCH"] = "off"  # the meaning search needs a downloaded model; its own tests switch it on with a stand-in
os.environ["MATERNASYNC_AI_PROVIDER"] = "rules"
os.environ["MATERNASYNC_AI_WORKER"] = "off"  # tests run the assistant's queue themselves, when they want it to run
os.environ["MATERNASYNC_AI_DAILY_CAP"] = "100000"  # the cap has its own test; it must not trip over the other tests' steps


def _cleanup():
    from backend.app.database import engine
    engine.dispose()
    temp.cleanup()


atexit.register(_cleanup)
