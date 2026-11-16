from flask import Blueprint, g, jsonify, request

from ..auth import current_user
from ..db import session_scope
from ..mcp_server.server import execute
from ..models import User
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
        result, status = execute(
            session,
            session.get(User, g.user.id),
            payload.tool_name,
            payload.payload,
            payload.idempotency_key,
        )
        return jsonify(result), status
