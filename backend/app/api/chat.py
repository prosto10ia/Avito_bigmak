import uuid

from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from ..auth import current_user
from ..db import session_scope
from ..mcp_server.server import proposal_storage_key, stable_key
from ..middleware.guardrails import validate_no_secrets
from ..models import RoadmapNode, ServiceRequest, User, UserNodeProgress
from ..schemas import ChatMessageRequest
from ..services.rag_service import collision_warning, escalation, search

bp = Blueprint("chat", __name__)


def forbidden_intent(user, message):
    lowered = message.lower()
    if user.role == "intern" and any(
        word in lowered for word in ("зарплат", "грейд", "чужой отпуск", "hr_confidential")
    ):
        return "RBAC_ROLE_DENIED"
    if (
        user.role == "intern"
        and any(word in lowered for word in ("fintech", "realestate", "real estate"))
        and user.cluster != "Fintech"
    ):
        return "ABAC_CLUSTER_DENIED"


def proposed_action(user, message):
    lowered = message.lower()
    if any(x in lowered for x in ("отгул", "отпуск", "больнич")):
        return {
            "tool_name": "create_absence_request",
            "title": "Оформить отсутствие",
            "summary": "Создать синтетическую заявку на отсутствие.",
            "idempotency_key": stable_key("create_absence_request", user.id, {"message": message}),
            "payload": {
                "type": "day_off",
                "date_from": "2026-11-20",
                "date_to": "2026-11-20",
                "reason": message,
            },
        }
    if any(x in lowered for x in ("jira", "stash", "доступ")):
        return {
            "tool_name": "request_service_access",
            "title": "Запросить доступ",
            "summary": "Создать синтетическую заявку на доступ к Jira.",
            "idempotency_key": stable_key("request_service_access", user.id, {"message": message}),
            "payload": {
                "node_id": "node_w1_access",
                "service_name": "jira",
                "project_key": "AUTO",
                "access_level": "read",
            },
        }
    if any(x in lowered for x in ("встреч", "созвон", "календар")):
        return {
            "tool_name": "schedule_calendar_meeting",
            "title": "Назначить встречу",
            "summary": "Создать синтетическое событие в календаре.",
            "idempotency_key": stable_key(
                "schedule_calendar_meeting", user.id, {"message": message}
            ),
            "payload": {
                "title": message,
                "agenda": message,
                "participant_id": user.mentor_id or "usr_buddy_1",
                "datetime": "2026-11-25T10:00:00+00:00",
                "duration_min": 30,
            },
        }


@bp.post("/chat/message")
@current_user
def chat():
    try:
        payload = ChatMessageRequest.model_validate(request.get_json(silent=True) or {})
    except Exception as exc:
        return jsonify({"error": "INVALID_REQUEST", "details": str(exc)}), 422
    if not validate_no_secrets(payload.message):
        return jsonify({"error": "GUARDRAIL_SECRET_DETECTED"}), 422
    denied = forbidden_intent(g.user, payload.message)
    if denied:
        return jsonify({"error": denied}), 403
    action = proposed_action(g.user, payload.message)
    if action:
        with session_scope() as session:
            if action["tool_name"] == "request_service_access":
                active_service_node = session.scalar(
                    select(RoadmapNode.id)
                    .join(UserNodeProgress, UserNodeProgress.node_id == RoadmapNode.id)
                    .where(
                        UserNodeProgress.user_id == g.user.id,
                        UserNodeProgress.status == "active",
                        RoadmapNode.node_type == "service_action",
                    )
                    .order_by(RoadmapNode.order_index)
                )
                node_id = active_service_node or action["payload"].get("node_id")
                action["payload"] = {**action["payload"], "node_id": node_id}
                action["idempotency_key"] = stable_key(
                    action["tool_name"], g.user.id, {"message": payload.message, "node_id": node_id}
                )
            proposal_key = proposal_storage_key(
                action["tool_name"], g.user.id, action["idempotency_key"]
            )
            existing = session.scalar(
                select(ServiceRequest).where(ServiceRequest.idempotency_key == proposal_key)
            )
            if existing is None:
                session.add(
                    ServiceRequest(
                        id=f"proposal_{uuid.uuid4().hex}",
                        user_id=g.user.id,
                        tool_name=action["tool_name"],
                        idempotency_key=proposal_key,
                        payload={"payload": action["payload"]},
                        status="pending_confirmation",
                    )
                )
        return jsonify(
            {
                "reply": "Подтвердите действие в карточке.",
                "answer": "Подтвердите действие в карточке.",
                "sources": [],
                "conflict_warning": None,
                "escalation": None,
                "proposed_mcp_action": action,
            }
        )
    with session_scope() as session:
        user = session.get(User, g.user.id)
        matches = search(session, user, payload.message)
        if not matches:
            return jsonify(
                {
                    "reply": "В синтетической базе знаний нет уверенного ответа.",
                    "answer": "В синтетической базе знаний нет уверенного ответа.",
                    "sources": [],
                    "conflict_warning": None,
                    "escalation": escalation(payload.message, user),
                    "proposed_mcp_action": None,
                }
            )
        sources = [
            {
                "id": c.id,
                "doc_title": c.doc_title,
                "source_url": c.source_url,
                "source_scope": c.source_scope,
                "version_date": c.version_date.isoformat(),
                "title": c.doc_title,
                "url": c.source_url,
                "content": c.content,
            }
            for _, c in matches[:5]
        ]
        return jsonify(
            {
                "reply": "\n".join(c.content for _, c in matches[:3]),
                "answer": "\n".join(c.content for _, c in matches[:3]),
                "sources": sources,
                "conflict_warning": collision_warning(matches),
                "escalation": None,
                "proposed_mcp_action": None,
            }
        )
