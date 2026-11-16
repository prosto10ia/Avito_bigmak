from datetime import date, timedelta

from flask import Blueprint, g, jsonify, request
from sqlalchemy import select, text

from ..auth import current_user
from ..db import session_scope
from ..models import DailyPulse, User
from ..schemas import PulseRequest
from ..services.gamification import level_for_xp

bp = Blueprint("pulse", __name__)


@bp.post("/pulse")
@current_user
def pulse():
    try:
        payload = PulseRequest.model_validate(request.get_json(silent=True) or {})
    except Exception as exc:
        return jsonify({"error": "INVALID_REQUEST", "details": str(exc)}), 422
    with session_scope() as session:
        user = session.get(User, g.user.id)
        today = date.today()
        if session.bind.dialect.name == "postgresql":
            session.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
                {"lock_key": f"pulse:{user.id}:{today.isoformat()}"},
            )
        existing = session.scalar(
            select(DailyPulse).where(DailyPulse.user_id == user.id, DailyPulse.pulse_date == today)
        )
        if existing:
            return jsonify(
                {
                    "id": existing.id,
                    "status": "already_recorded",
                    "xp_awarded": 0,
                    "streak_days": user.streak_days,
                }
            ), 200
        previous = user.last_pulse_date
        if previous == today - timedelta(days=1):
            user.streak_days = max(1, user.streak_days) + 1
        else:
            user.streak_days = max(1, user.streak_days)
        user.last_pulse_date = today
        user.xp = max(0, user.xp) + 15
        user.level = level_for_xp(user.xp)
        record = DailyPulse(
            user_id=user.id,
            pulse_date=today,
            mood_score=payload.mood_score,
            blocker_tags=payload.blocker_tags,
            comment=payload.comment,
            xp_awarded=15,
        )
        session.add(record)
        session.flush()
        return jsonify(
            {
                "id": record.id,
                "status": "recorded",
                "xp_awarded": 15,
                "streak_days": user.streak_days,
            }
        ), 201
