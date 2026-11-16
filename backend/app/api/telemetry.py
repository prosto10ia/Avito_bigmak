from flask import Blueprint, g, jsonify, request

from ..auth import current_user
from ..db import session_scope
from ..middleware.guardrails import validate_no_secrets
from ..models import ClickstreamEvent
from ..schemas import TelemetryEventRequest

bp = Blueprint("telemetry", __name__)


@bp.post("/telemetry")
@current_user
def telemetry():
    try:
        payload = TelemetryEventRequest.model_validate(request.get_json(silent=True) or {})
    except Exception as exc:
        return jsonify({"error": "INVALID_REQUEST", "details": str(exc)}), 422
    if not validate_no_secrets(payload.model_dump()):
        return jsonify({"error": "GUARDRAIL_SECRET_DETECTED"}), 422
    with session_scope() as session:
        event = ClickstreamEvent(
            user_id=g.user.id,
            role=g.user.role,
            event_name=payload.event_name,
            metadata_json=payload.metadata,
        )
        session.add(event)
        session.flush()
        return jsonify({"id": event.id, "status": "recorded"}), 201
