from flask import Blueprint, g, jsonify, request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..auth import current_user
from ..db import session_scope
from ..mcp_server.server import execute, proposal_storage_key, scoped_idempotency_key
from ..models import ServiceRequest, User
from ..schemas import ExecuteMCPRequest

bp = Blueprint("mcp", __name__)


@bp.post("/mcp/execute")
@current_user
def mcp_execute():
    try:
        payload = ExecuteMCPRequest.model_validate(request.get_json(silent=True) or {})
    except Exception as exc:
        return jsonify({"error": "INVALID_REQUEST", "details": str(exc)}), 422
    if not payload.confirmed:
        return jsonify({"error": "CONFIRMATION_REQUIRED"}), 422
    with session_scope() as session:
        final_key = scoped_idempotency_key(payload.tool_name, g.user.id, payload.idempotency_key)
        existing = session.scalar(
            select(ServiceRequest).where(
                ServiceRequest.idempotency_key == final_key,
                ServiceRequest.user_id == g.user.id,
                ServiceRequest.tool_name == payload.tool_name,
            )
        )
        proposal = None
        if payload.tool_name in {
            "create_absence_request",
            "request_service_access",
            "schedule_calendar_meeting",
        }:
            proposal = session.scalar(
                select(ServiceRequest)
                .where(
                    ServiceRequest.idempotency_key
                    == proposal_storage_key(payload.tool_name, g.user.id, payload.idempotency_key),
                    ServiceRequest.user_id == g.user.id,
                    ServiceRequest.tool_name == payload.tool_name,
                    ServiceRequest.status.in_({"pending_confirmation", "completed"}),
                )
                .with_for_update()
            )
            if proposal is None or proposal.payload.get("payload") != payload.payload:
                return jsonify({"error": "PROPOSAL_REQUIRED"}), 422
        try:
            result, status = execute(
                session,
                session.get(User, g.user.id),
                payload.tool_name,
                payload.payload,
                payload.idempotency_key,
            )
        except IntegrityError:
            session.rollback()
            existing = session.scalar(
                select(ServiceRequest).where(
                    ServiceRequest.idempotency_key
                    == scoped_idempotency_key(
                        payload.tool_name, g.user.id, payload.idempotency_key
                    ),
                    ServiceRequest.user_id == g.user.id,
                    ServiceRequest.tool_name == payload.tool_name,
                )
            )
            if existing is None:
                return jsonify({"error": "IDEMPOTENCY_CONFLICT"}), 409
            result, status = existing.payload, 200
        if proposal is not None and status == 200:
            proposal.status = "completed"
        return jsonify(result), status
