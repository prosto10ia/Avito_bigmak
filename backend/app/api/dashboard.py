from datetime import date

from flask import Blueprint, g, jsonify
from sqlalchemy import select

from ..auth import current_user, profile
from ..db import session_scope
from ..models import CalendarEvent, DailyPulse, RoadmapNode, UserNodeProgress

bp = Blueprint("dashboard", __name__)


@bp.get("/dashboard")
@current_user
def dashboard():
    with session_scope() as session:
        nodes = session.execute(
            select(RoadmapNode, UserNodeProgress)
            .outerjoin(
                UserNodeProgress,
                (UserNodeProgress.node_id == RoadmapNode.id)
                & (UserNodeProgress.user_id == g.user.id),
            )
            .order_by(RoadmapNode.order_index)
            .limit(3)
        ).all()
        meetings = session.scalars(
            select(CalendarEvent)
            .where(CalendarEvent.user_id == g.user.id)
            .order_by(CalendarEvent.starts_at)
            .limit(2)
        ).all()
        pulse = session.scalar(
            select(DailyPulse).where(
                DailyPulse.user_id == g.user.id, DailyPulse.pulse_date == date.today()
            )
        )
        data = profile(g.user, session)
        data["pulse_completed_today"] = pulse is not None
        return jsonify(
            {
                "profile": data,
                "mascot": {
                    "xp": g.user.xp,
                    "level": g.user.level,
                    "mascot_stage": data["mascot_stage"],
                    "streak_days": g.user.streak_days,
                },
                "active_nodes": [
                    {
                        "id": n.id,
                        "period": n.period,
                        "title": n.title,
                        "description": n.description,
                        "node_type": n.node_type,
                        "xp_reward": n.xp_reward,
                        "order_index": n.order_index,
                        "status": p.status if p else "locked",
                        "verification_config": n.verification_config,
                        "verified_artifact": p.verified_artifact if p else None,
                        "verification_feedback": p.verification_feedback if p else None,
                    }
                    for n, p in nodes
                ],
                "upcoming_events": [
                    {
                        "id": e.id,
                        "title": e.title,
                        "event_type": e.event_type,
                        "starts_at": e.starts_at.isoformat(),
                        "duration_min": e.duration_min,
                        "agenda": e.agenda,
                    }
                    for e in meetings
                ],
                "pulse": {
                    "completed_today": pulse is not None,
                    "mood_score": pulse.mood_score if pulse else None,
                },
            }
        )
