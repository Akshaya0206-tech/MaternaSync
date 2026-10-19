"""Event type constants. A string, not an enum class, so handlers.py's
registry and dispatcher.py's AuditLog action names stay simple and
human-readable without an extra import at every call site."""

DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
PATIENT_QUESTION_CREATED = "PATIENT_QUESTION_CREATED"
