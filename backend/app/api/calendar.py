from collections import defaultdict
from datetime import datetime

from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from ..auth import current_user
from ..db import session_scope
from ..models import CalendarEvent, DailyPulse, RoadmapNode, User, UserNodeProgress
from ..schemas import SummaryRequest
from ..services.llm_provider import OfflineMockLLM

bp = Blueprint("calendar", __name__)


@bp.get("/calendar")
@current_user
def calendar():
    with session_scope() as session:
        query = select(CalendarEvent).where(CalendarEvent.user_id == g.user.id)
        month = request.args.get("month")
        if month:
            try:
                month_start = datetime.strptime(month, "%Y-%m")
            except ValueError:
                return jsonify(
                    {"error": "INVALID_REQUEST", "details": "month must be YYYY-MM"}
                ), 422
            if month_start.month == 12:
                next_month = month_start.replace(year=month_start.year + 1, month=1)
            else:
                next_month = month_start.replace(month=month_start.month + 1)
            query = query.where(
                CalendarEvent.starts_at >= month_start,
                CalendarEvent.starts_at < next_month,
            )
        events = session.scalars(query.order_by(CalendarEvent.starts_at)).all()
        serialized = [
            {
                "id": e.id,
                "title": e.title,
                "event_type": e.event_type,
                "starts_at": e.starts_at.isoformat(),
                "duration_min": e.duration_min,
                "agenda": e.agenda,
                "auto_summary": e.auto_summary,
            }
            for e in events
        ]
        days = defaultdict(list)
        for event in serialized:
            days[event["starts_at"][:10]].append(event["id"])
        return jsonify(
            {
                "events": serialized,
                "days": [
                    {"date": date, "event_count": len(event_ids), "event_ids": event_ids}
                    for date, event_ids in sorted(days.items())
                ],
            }
        )


@bp.post("/calendar/summary")
@current_user
def summary():
    try:
        payload = SummaryRequest.model_validate(request.get_json(silent=True) or {})
    except Exception as exc:
        return jsonify({"error": "INVALID_REQUEST", "details": str(exc)}), 422
    with session_scope() as session:
        user = session.get(User, g.user.id)
        completed = session.scalars(
            select(UserNodeProgress).where(
                UserNodeProgress.user_id == user.id, UserNodeProgress.status == "done"
            )
        ).all()
        nodes = {n.id: n.title for n in session.scalars(select(RoadmapNode)).all()}
        pulses = session.scalars(select(DailyPulse).where(DailyPulse.user_id == user.id)).all()
        kind = payload.effective_kind
        context = f"kind={kind}; xp={user.xp}; completed={[nodes.get(p.node_id) for p in completed]}; blockers={[tag for p in pulses for tag in (p.blocker_tags or [])]}"
        generated = OfflineMockLLM().generate(context)
        return jsonify(
            {
                "kind": kind,
                "summary": generated,
                "xp": user.xp,
                "completed_nodes": [nodes.get(p.node_id) for p in completed],
                "blocker_tags": [tag for p in pulses for tag in (p.blocker_tags or [])],
                "offline": True,
            }
        )
