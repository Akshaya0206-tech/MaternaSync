from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import JWT_ALGORITHM, JWT_EXPIRES_MINUTES, JWT_SECRET


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, token_version: int | None = 0) -> str:
    """`token_version` is the user's session counter (User.token_version); it is checked on every request (deps.get_current_user)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MINUTES)
    payload = {"sub": user_id, "exp": expire, "ver": int(token_version or 0)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_claims(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def decode_access_token(token: str) -> str | None:
    claims = decode_access_claims(token)
    return claims.get("sub") if claims else None
