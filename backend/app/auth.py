from datetime import date
from functools import wraps

from flask import current_app, g, jsonify, request
from sqlalchemy import select

from .db import session_scope
from .models import DailyPulse, User


def current_user(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if request.headers.get("X-Demo-Access-Code") != current_app.config["DEMO_ACCESS_CODE"]:
            return jsonify({"error": "INVALID_DEMO_ACCESS_CODE"}), 403
        user_id = request.headers.get("X-User-Id")
        claimed_role = request.headers.get("X-User-Role")
        with session_scope() as session:
            user = session.scalar(select(User).where(User.id == user_id))
            if user is None:
                return jsonify({"error": "UNKNOWN_USER"}), 401
            if claimed_role != user.role:
                return jsonify({"error": "AUTH_ROLE_MISMATCH"}), 403
            g.user = user
            return view(*args, **kwargs)

    return wrapped


def profile(user: User, session=None) -> dict:
    mentor = session.get(User, user.mentor_id) if session and user.mentor_id else None
    manager = session.get(User, user.manager_id) if session and user.manager_id else None
    return {
        "id": user.id,
        "full_name": user.full_name,
        "role": user.role,
        "job_title": user.job_title,
        "team": user.team,
        "cluster": user.cluster,
        "mentor_name": mentor.full_name if mentor else "",
        "manager_name": manager.full_name if manager else "",
        "xp": user.xp,
        "level": user.level,
        "mascot_stage": "egg"
        if user.xp < 100
        else "chick"
        if user.xp < 300
        else "wingman"
        if user.xp < 600
        else "legend",
        "streak_days": user.streak_days,
        "pulse_completed_today": bool(
            session
            and session.scalar(
                select(DailyPulse).where(
                    DailyPulse.user_id == user.id, DailyPulse.pulse_date == date.today()
                )
            )
        ),
    }
