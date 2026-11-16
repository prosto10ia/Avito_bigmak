import hashlib
import json
import uuid
from datetime import datetime

from sqlalchemy import select, text

from ..middleware.guardrails import validate_no_secrets
from ..middleware.rbac import assert_project_access
from ..models import CalendarEvent, RoadmapNode, ServiceRequest, User, UserNodeProgress
from ..services.gamification import complete_node
from .adapters import absence, access, validate_artifact

TOOLS = {
    "create_absence_request",
    "request_service_access",
    "schedule_calendar_meeting",
    "verify_onboarding_task",
}


def stable_key(tool_name: str, user_id: str, payload: dict) -> str:
    raw = f"{tool_name}|{user_id}|{payload}".encode()
    return hashlib.sha256(raw).hexdigest()


def scoped_idempotency_key(tool_name: str, user_id: str, key: str) -> str:
    return hashlib.sha256(f"{tool_name}|{user_id}|{key}".encode()).hexdigest()


def proposal_storage_key(tool_name: str, user_id: str, key: str) -> str:
    return f"proposal:{scoped_idempotency_key(tool_name, user_id, key)}"


def verify_onboarding_task(session, user, payload):
    node = session.get(RoadmapNode, payload.get("node_id"))
    if node is None:
        return {"success": False, "status": "rejected", "message": "Unknown node"}, 404
    if node.target_role != user.role:
        return {"error": "RBAC_ROLE_DENIED"}, 403
    progress = session.scalar(
        select(UserNodeProgress).where(
            UserNodeProgress.user_id == user.id, UserNodeProgress.node_id == node.id
        )
    )
    if progress is None or progress.status not in {"active", "waiting_approval", "done"}:
        return {
            "success": False,
            "tool_name": "verify_onboarding_task",
            "status": "rejected",
            "message": "Node dependency is not complete",
        }, 422
    allowed_artifacts = {
        "guide": {"cli_log", "screenshot"},
        "quiz": {"quiz_answers"},
    }.get(node.node_type, set())
    if node.node_type == "service_action" or payload.get("artifact_type") not in allowed_artifacts:
        return {
            "success": False,
            "tool_name": "verify_onboarding_task",
            "status": "rejected",
            "message": "Use the matching verification flow for this node",
        }, 422
    if not validate_no_secrets(payload.get("content", "")):
        return {"error": "GUARDRAIL_SECRET_DETECTED"}, 422
    ok, message = validate_artifact(payload.get("artifact_type", ""), payload.get("content", ""))
    if not ok:
        return {
            "success": False,
            "tool_name": "verify_onboarding_task",
            "status": "rejected",
            "message": message,
        }, 422
    progress, _ = complete_node(session, user, node, payload["content"], message)
    if progress.status == "locked":
        return {
            "success": False,
            "tool_name": "verify_onboarding_task",
            "status": "rejected",
            "message": "Node dependency is not complete",
        }, 422
    return {
        "success": True,
        "tool_name": "verify_onboarding_task",
        "status": progress.status,
        "message": message,
        "data": {"xp": user.xp, "level": user.level},
    }, 200


def validate_tool_payload(tool_name: str, payload: dict):
    required = {
        "create_absence_request": ("type", "date_from", "date_to", "reason"),
        "request_service_access": ("service_name", "project_key", "access_level"),
        "schedule_calendar_meeting": (
            "participant_id",
            "title",
            "datetime",
            "duration_min",
            "agenda",
        ),
        "verify_onboarding_task": ("node_id", "artifact_type", "content"),
    }[tool_name]
    if any(not payload.get(field) for field in required):
        return "INVALID_REQUEST"
    if tool_name == "create_absence_request" and payload["type"] not in {
        "day_off",
        "vacation",
        "sick_leave",
    }:
        return "INVALID_REQUEST"
    if tool_name == "request_service_access" and payload["access_level"] not in {
        "read",
        "write",
        "admin",
    }:
        return "INVALID_REQUEST"
    if tool_name == "request_service_access" and payload["service_name"] not in {
        "jira",
        "confluence",
        "stash",
        "k8s_namespace",
    }:
        return "INVALID_REQUEST"
    if tool_name == "create_absence_request":
        try:
            date_from = datetime.fromisoformat(str(payload["date_from"])).date()
            date_to = datetime.fromisoformat(str(payload["date_to"])).date()
            if date_to < date_from:
                return "INVALID_REQUEST"
        except (TypeError, ValueError):
            return "INVALID_REQUEST"
    if tool_name == "schedule_calendar_meeting":
        try:
            if not 15 <= int(payload["duration_min"]) <= 240:
                return "INVALID_REQUEST"
            datetime.fromisoformat(str(payload["datetime"]))
        except (TypeError, ValueError):
            return "INVALID_REQUEST"
    return None


def execute(session, user, tool_name: str, payload: dict, key: str):
    storage_key = scoped_idempotency_key(tool_name, user.id, key)
    if session.bind.dialect.name == "postgresql":
        session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
            {"lock_key": f"mcp:{storage_key}"},
        )
    existing = session.scalar(
        select(ServiceRequest)
        .where(ServiceRequest.idempotency_key == storage_key)
        .with_for_update()
    )
    if existing:
        if existing.user_id != user.id or existing.tool_name != tool_name:
            return {"error": "IDEMPOTENCY_KEY_OWNED"}, 409
        return existing.payload, 200
    if tool_name not in TOOLS:
        return {"error": "UNKNOWN_TOOL"}, 422
    if not validate_no_secrets(json.dumps(payload, ensure_ascii=False)):
        return {"error": "GUARDRAIL_SECRET_DETECTED"}, 422
    invalid = validate_tool_payload(tool_name, payload)
    if invalid:
        return {"error": invalid}, 422
    payload = dict(payload)
    claimed_user = payload.pop("user_id", None)
    if claimed_user and claimed_user != user.id:
        return {"error": "IDENTITY_MISMATCH"}, 403
    payload["user_id"] = user.id
    request_id = uuid.uuid4().hex
    result = {
        "success": True,
        "tool_name": tool_name,
        "status": "completed",
        "message": "Simulated offline action",
        "data": {},
    }
    external = None
    if tool_name == "create_absence_request":
        external = absence(request_id)
    elif tool_name == "request_service_access":
        denied = assert_project_access(
            user, payload.get("project_key", ""), payload.get("access_level", "")
        )
        if denied:
            return {"error": denied[0]}, denied[1]
        external = access(request_id)
        access_node = (
            session.get(RoadmapNode, payload.get("node_id"))
            if payload.get("node_id")
            else session.scalar(
                select(RoadmapNode).where(
                    RoadmapNode.node_type == "service_action", RoadmapNode.id == "node_m1_access"
                )
            )
        )
        if access_node and access_node.node_type != "service_action":
            return {"error": "INVALID_REQUEST"}, 422
        if access_node and access_node.target_role != user.role:
            return {"error": "RBAC_ROLE_DENIED"}, 403
        if payload.get("node_id"):
            target_node_id = access_node.id if access_node else payload["node_id"]
            progress = session.scalar(
                select(UserNodeProgress).where(
                    UserNodeProgress.user_id == user.id,
                    UserNodeProgress.node_id == target_node_id,
                )
            )
            if (
                access_node is None
                or progress is None
                or progress.status not in {"active", "waiting_approval"}
            ):
                return {"error": "INVALID_REQUEST"}, 422
        if access_node:
            complete_node(session, user, access_node, external, "Service access request completed")
    elif tool_name == "schedule_calendar_meeting":
        try:
            starts_at = datetime.fromisoformat(payload["datetime"])
            participant = session.get(User, payload.get("participant_id"))
            if participant is None or not 15 <= int(payload.get("duration_min", 0)) <= 240:
                raise ValueError
        except (KeyError, TypeError, ValueError):
            return {"error": "INVALID_REQUEST"}, 422
        event = CalendarEvent(
            id=f"event_{request_id}",
            user_id=user.id,
            participant_id=participant.id,
            title=payload["title"],
            event_type="one_on_one",
            starts_at=starts_at,
            duration_min=int(payload["duration_min"]),
            agenda=payload["agenda"],
        )
        session.add(event)
        result["data"] = {
            "id": event.id,
            "title": event.title,
            "starts_at": event.starts_at.isoformat(),
            "duration_min": event.duration_min,
        }
    elif tool_name == "verify_onboarding_task":
        result, status = verify_onboarding_task(session, user, payload)
        if status != 200:
            return result, status
        record = ServiceRequest(
            id=request_id,
            user_id=user.id,
            tool_name=tool_name,
            idempotency_key=storage_key,
            payload=result,
            status="completed",
        )
        session.add(record)
        session.flush()
        return result, status
    if external:
        result["external_ticket_id"] = external
    record = ServiceRequest(
        id=request_id,
        user_id=user.id,
        tool_name=tool_name,
        idempotency_key=storage_key,
        payload=result,
        status="completed",
        external_ticket_id=external,
    )
    session.add(record)
    session.flush()
    return result, 200
