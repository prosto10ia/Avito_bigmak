from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from ..auth import current_user
from ..db import session_scope
from ..mcp_server.server import verify_onboarding_task
from ..middleware.guardrails import validate_no_secrets
from ..models import RoadmapNode, User, UserNodeProgress
from ..schemas import VerifyNodeRequest

bp = Blueprint("roadmap", __name__)


@bp.get("/roadmap")
@current_user
def roadmap():
    with session_scope() as session:
        rows = session.execute(
            select(RoadmapNode, UserNodeProgress)
            .outerjoin(
                UserNodeProgress,
                (UserNodeProgress.node_id == RoadmapNode.id)
                & (UserNodeProgress.user_id == g.user.id),
            )
            .order_by(RoadmapNode.order_index)
        ).all()
        nodes = [
            {
                "id": n.id,
                "period": n.period,
                "title": n.title,
                "description": n.description,
                "node_type": n.node_type,
                "xp_reward": n.xp_reward,
                "order_index": n.order_index,
                "depends_on_node_id": n.depends_on_node_id,
                "status": p.status if p else "locked",
                "verified_artifact": p.verified_artifact if p else None,
                "verification_feedback": p.verification_feedback if p else None,
            }
            for n, p in rows
        ]
        result = {
            "nodes": nodes,
            "progress": {
                "xp": g.user.xp,
                "level": g.user.level,
                "completed": sum(n["status"] == "done" for n in nodes),
            },
        }
        result["roadmap"] = nodes
        return jsonify(result)


@bp.post("/roadmap/nodes/<node_id>/verify")
@current_user
def verify(node_id):
    try:
        payload = VerifyNodeRequest.model_validate(request.get_json(silent=True) or {})
    except Exception as exc:
        return jsonify({"error": "INVALID_REQUEST", "details": str(exc)}), 422
    if not validate_no_secrets(payload.content):
        return jsonify({"error": "GUARDRAIL_SECRET_DETECTED"}), 422
    with session_scope() as session:
        result, status = verify_onboarding_task(
            session, session.get(User, g.user.id), {"node_id": node_id, **payload.model_dump()}
        )
        return jsonify(result), status
