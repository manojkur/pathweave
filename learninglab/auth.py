"""One configured owner, opaque revocable sessions, no public registration."""

import hashlib
import hmac
import os
import secrets
import time

from fastapi import HTTPException, Request

from .store import db, get

COOKIE = "learning_session"


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${digest}"


def password_matches(password, stored):
    try:
        algorithm, salt, _ = stored.split("$")
        return algorithm == "scrypt" and hmac.compare_digest(password_hash(password, salt), stored)
    except (ValueError, TypeError):
        return False


def configured_hash():
    return get("owner_password_hash") or os.environ.get("OWNER_PASSWORD_HASH", "")


def same_origin(request: Request):
    # Browsers always send Origin for our JSON mutations. Never trust a client-supplied Host.
    expected = os.environ.get("APP_ORIGIN", "http://localhost:8000").rstrip("/")
    if request.headers.get("origin", "").rstrip("/") != expected:
        raise HTTPException(403, "Request origin rejected")


def fingerprint(token):
    return hashlib.sha256(token.encode()).hexdigest()


def require_owner(request: Request):
    token = request.cookies.get(COOKIE, "")
    with db() as con:
        row = con.execute(
            "SELECT * FROM sessions WHERE token=? AND expires>?", (fingerprint(token), time.time())
        ).fetchone()
    if row is None:
        raise HTTPException(401, "Please sign in")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        same_origin(request)
        if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), row["csrf"]):
            raise HTTPException(403, "Session verification failed")
    return dict(row)


def authenticate(request, username, password):
    same_origin(request)
    configured = configured_hash()
    if not configured or not os.environ.get("OWNER_USERNAME"):
        raise HTTPException(503, "Owner login has not been configured")
    # Persistent global bucket prevents bypass by spoofing forwarded headers or restarting the app.
    key = f"login:{int(time.time() // 900)}"
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        con.execute(
            "INSERT INTO limits(key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1", (key,)
        )
        count = con.execute("SELECT count FROM limits WHERE key=?", (key,)).fetchone()[0]
    if count > 15:
        raise HTTPException(429, "Please wait before trying again")
    matches = password_matches(password, configured)
    if not (hmac.compare_digest(username, os.environ["OWNER_USERNAME"]) and matches):
        raise HTTPException(401, "Incorrect sign-in details")
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    with db() as con:
        con.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
        con.execute("INSERT INTO sessions VALUES (?,?,?)", (fingerprint(token), csrf, time.time() + 43200))
    return token, csrf
