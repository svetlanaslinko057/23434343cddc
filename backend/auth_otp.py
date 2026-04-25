"""
Email-code (OTP) auth — the zero-friction entry point.

Pairs with the password-first flow, not a replacement: user keeps the
choice ("Use password instead"). Two endpoints:

    POST /api/auth/send-code   — public, accepts {email}, issues 6-digit code
    POST /api/auth/verify-code — public, accepts {email, code, name?}, returns
                                 the same {token, user} shape as /mobile/auth/*

No email delivery is wired in this sandbox, so `send-code` returns the code
back in a `dev_code` field (and logs it). Swap in SendGrid/Resend later —
the API contract stays identical.
"""

from __future__ import annotations

import logging
import os
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("auth_otp")

# Injected on wire()
_db = None
_hash_password = None

# Config
CODE_TTL_SECONDS = 10 * 60
CODE_MAX_ATTEMPTS = 5
# Throttle: cool-down after a code was issued so a user can't spam the mailer.
CODE_RESEND_COOLDOWN = 30
# Surface the code in the HTTP response so the UI can show it when email
# delivery is not configured. Flip to False once a real email provider is
# wired.
DEV_MODE = os.environ.get("AUTH_OTP_DEV_MODE", "true").lower() != "false"


def wire(*, db, hash_password):
    global _db, _hash_password
    _db = db
    _hash_password = hash_password


def _now():
    return datetime.now(timezone.utc)


def _now_iso():
    return _now().isoformat()


class SendCodeReq(BaseModel):
    email: EmailStr


class VerifyCodeReq(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=8)
    # Only used for brand-new users; ignored if the account already exists.
    name: Optional[str] = None


def _to_mobile_user(u: dict) -> dict:
    """Same shape as `mobile_adapter._to_mobile_user` — kept here so we don't
    couple this module to `mobile_adapter`'s internals."""
    if not u:
        return None
    roles = u.get("roles") or ([u.get("role") or "client"])
    active_role = u.get("active_role") or roles[0]
    return {
        "user_id": u.get("user_id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "picture": u.get("picture"),
        "roles": roles,
        "active_role": active_role,
        "role": active_role,
        "tier": u.get("tier") or u.get("subscription") or "starter",
        "strikes": int(u.get("strikes") or 0),
        "capacity": int(u.get("capacity") or 5),
        "active_modules": int(u.get("active_modules") or u.get("active_load") or 0),
        "level": u.get("level") or "junior",
        "rating": u.get("rating") or 5.0,
        "skills": u.get("skills") or [],
        "is_demo": bool(u.get("is_demo") or False),
    }


async def _create_session(user_id: str) -> str:
    token = f"sess_{uuid.uuid4().hex}"
    expires_at = _now() + timedelta(days=7)
    await _db.user_sessions.insert_one({
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": token,
        "expires_at": expires_at.isoformat(),
        "created_at": _now_iso(),
    })
    return token


def _gen_code() -> str:
    return f"{random.randint(0, 999_999):06d}"


def build_router() -> APIRouter:
    r = APIRouter(tags=["auth-otp"])

    @r.post("/auth/send-code")
    async def send_code(req: SendCodeReq):
        email = req.email.strip().lower()

        # Throttle: reject rapid resends from the same email.
        existing = await _db.auth_codes.find_one(
            {"email": email, "consumed_at": None},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        if existing:
            try:
                last = datetime.fromisoformat(existing["created_at"])
                age = (_now() - last).total_seconds()
                if age < CODE_RESEND_COOLDOWN:
                    raise HTTPException(
                        status_code=429,
                        detail=f"Please wait {int(CODE_RESEND_COOLDOWN - age)}s before requesting a new code",
                    )
            except (KeyError, ValueError):
                pass

        code = _gen_code()
        doc = {
            "email": email,
            "code": code,
            "expires_at": (_now() + timedelta(seconds=CODE_TTL_SECONDS)).isoformat(),
            "created_at": _now_iso(),
            "attempts": 0,
            "consumed_at": None,
        }
        await _db.auth_codes.insert_one(doc)

        # TODO: wire real email delivery (SendGrid/Resend). For now:
        # - Log server-side (audit)
        # - Return in response body in DEV_MODE so the UI can surface it
        logger.info(f"AUTH OTP: code={code} → {email} (DEV mode: surfaced in response)")

        # Whether the account exists helps the UI word the next step
        # ("create account" vs "welcome back") without leaking any PII.
        user = await _db.users.find_one({"email": email}, {"_id": 0, "user_id": 1}) or None
        resp = {
            "ok": True,
            "sent_at": doc["created_at"],
            "expires_in": CODE_TTL_SECONDS,
            "is_new_user": not bool(user),
        }
        if DEV_MODE:
            resp["dev_code"] = code
        return resp

    @r.post("/auth/verify-code")
    async def verify_code(req: VerifyCodeReq, response: Response):
        email = req.email.strip().lower()
        code = req.code.strip()

        doc = await _db.auth_codes.find_one(
            {"email": email, "consumed_at": None},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if not doc:
            raise HTTPException(status_code=400, detail="No active code. Request a new one.")

        # TTL
        try:
            expires = datetime.fromisoformat(doc["expires_at"])
            if expires < _now():
                raise HTTPException(status_code=400, detail="Code expired. Request a new one.")
        except (KeyError, ValueError):
            raise HTTPException(status_code=400, detail="Code expired. Request a new one.")

        # Attempts
        attempts = int(doc.get("attempts") or 0)
        if attempts >= CODE_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

        if code != doc["code"]:
            await _db.auth_codes.update_one(
                {"email": email, "code": doc["code"], "consumed_at": None},
                {"$inc": {"attempts": 1}},
            )
            raise HTTPException(status_code=400, detail="Invalid code.")

        # Mark consumed
        await _db.auth_codes.update_one(
            {"email": email, "code": doc["code"], "consumed_at": None},
            {"$set": {"consumed_at": _now_iso()}},
        )

        # Find-or-create user
        user = await _db.users.find_one({"email": email}, {"_id": 0}) or None
        if not user:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            display = (req.name or email.split("@")[0]).strip()
            user = {
                "user_id": user_id,
                "email": email,
                "password_hash": None,  # code-only account; password can be set later
                "name": display,
                "picture": None,
                "role": "client",
                "roles": ["client"],
                "active_role": "client",
                "skills": [],
                "level": "junior",
                "rating": 5.0,
                "completed_tasks": 0,
                "active_load": 0,
                "capacity": 5,
                "auth_methods": ["code"],
                "created_at": _now_iso(),
            }
            await _db.users.insert_one(user)
            logger.info(f"AUTH OTP: new user via code {user_id} {email}")
        else:
            # Record that this user has verified via code at least once.
            methods = set(user.get("auth_methods") or [])
            methods.add("code")
            await _db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"auth_methods": list(methods)}},
            )

        token = await _create_session(user["user_id"])
        response.set_cookie(
            key="session_token", value=token,
            httponly=True, secure=True, samesite="none", path="/",
            max_age=7 * 24 * 60 * 60,
        )
        user.pop("password_hash", None)
        return {"token": token, "user": _to_mobile_user(user)}

    return r
