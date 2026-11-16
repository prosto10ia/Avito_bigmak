from flask import Blueprint, jsonify, request
from sqlalchemy import select

from ..auth import current_user, profile
from ..db import session_scope
from ..models import User
from ..schemas import SwitchRoleRequest

bp = Blueprint("auth", __name__)


@bp.post("/auth/switch-role")
@current_user
def switch_role():
    try:
        payload = SwitchRoleRequest.model_validate(request.get_json(silent=True) or {})
    except Exception as exc:
        return jsonify({"error": "INVALID_REQUEST", "details": str(exc)}), 422
    with session_scope() as session:
        target = session.scalar(select(User).where(User.role == payload.target_role))
        if target is None:
            return jsonify({"error": "ROLE_NOT_SEEDED"}), 404
        return jsonify(profile(target, session))
