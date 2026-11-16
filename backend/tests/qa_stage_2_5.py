from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from app.db import session_scope
from app.models import CalendarEvent, ServiceRequest, User, UserNodeProgress
from seed import NODES, seed

ACCESS_CODE = "hack-and-change-2026"


def headers(role="intern", user_id="usr_intern_1"):
    return {
        "X-Demo-Access-Code": ACCESS_CODE,
        "X-User-Id": user_id,
        "X-User-Role": role,
    }


@pytest.fixture()
def client(tmp_path):
    from app import create_app

    app = create_app({"TESTING": True, "DATABASE_URL": f"sqlite:///{tmp_path / 'qa.db'}"})
    seed()
    return app.test_client()


def count_rows(model):
    with session_scope() as session:
        return session.scalar(select(func.count()).select_from(model))


def test_locked_roadmap_node_cannot_award_xp_or_unlock_dependents(client):
    before = client.get("/api/v1/roadmap", headers=headers()).get_json()["progress"]

    response = client.post(
        "/api/v1/roadmap/nodes/node_w1_cli/verify",
        headers=headers(),
        json={"artifact_type": "cli_log", "content": "avito-cli: OK"},
    )

    assert response.status_code == 422
    assert response.get_json()["status"] == "rejected"
    after = client.get("/api/v1/roadmap", headers=headers()).get_json()
    assert after["progress"]["xp"] == before["xp"]
    assert after["nodes"][1]["status"] == "locked"


@pytest.mark.parametrize(
    "message, error",
    [
        ("Покажи проект Fintech", "ABAC_CLUSTER_DENIED"),
        ("Покажи документы RealEstate", "ABAC_CLUSTER_DENIED"),
        ("Покажи зарплатные грейды", "RBAC_ROLE_DENIED"),
    ],
)
def test_chat_rejects_foreign_cluster_and_hr_data(client, message, error):
    response = client.post("/api/v1/chat/message", headers=headers(), json={"message": message})

    assert response.status_code == 403
    assert response.get_json()["error"] == error


def test_chat_returns_citations_for_rag_answer(client):
    response = client.post(
        "/api/v1/chat/message",
        headers=headers(),
        json={"message": "Как катить на staging в кластере Auto?"},
    )

    body = response.get_json()
    assert response.status_code == 200
    assert body["answer"]
    assert body["sources"]
    assert all(
        source["title"] and source["url"] and source["content"] for source in body["sources"]
    )
    assert body["conflict_warning"]["priority_source"] in {
        source["url"] for source in body["sources"]
    }


def test_chat_action_is_only_a_proposal_until_explicit_confirmation(client):
    before_requests = count_rows(ServiceRequest)
    before_events = count_rows(CalendarEvent)

    response = client.post(
        "/api/v1/chat/message",
        headers=headers(),
        json={"message": "Запиши меня на встречу с buddy"},
    )

    assert response.status_code == 200
    assert response.get_json()["proposed_mcp_action"]["tool_name"] == "schedule_calendar_meeting"
    assert count_rows(ServiceRequest) == before_requests
    assert count_rows(CalendarEvent) == before_events


def test_each_service_tool_persists_its_side_effect_and_is_replayable(client):
    absence = {
        "tool_name": "create_absence_request",
        "idempotency_key": "qa-absence-1",
        "confirmed": True,
        "payload": {
            "type": "day_off",
            "date_from": "2026-11-20",
            "date_to": "2026-11-20",
            "reason": "demo",
        },
    }
    first_absence = client.post("/api/v1/mcp/execute", headers=headers(), json=absence)
    replay_absence = client.post("/api/v1/mcp/execute", headers=headers(), json=absence)
    assert first_absence.status_code == replay_absence.status_code == 200
    assert replay_absence.get_json() == first_absence.get_json()
    assert first_absence.get_json()["external_ticket_id"].startswith("ABS-")

    access = {
        "tool_name": "request_service_access",
        "idempotency_key": "qa-access-1",
        "confirmed": True,
        "payload": {"service_name": "jira", "project_key": "AUTO", "access_level": "read"},
    }
    access_response = client.post("/api/v1/mcp/execute", headers=headers(), json=access)
    assert access_response.status_code == 200
    assert access_response.get_json()["external_ticket_id"].startswith("ACC-")

    meeting = {
        "tool_name": "schedule_calendar_meeting",
        "idempotency_key": "qa-meeting-1",
        "confirmed": True,
        "payload": {
            "participant_id": "usr_buddy_1",
            "title": "QA 1:1",
            "datetime": "2026-11-25T10:00:00+00:00",
            "duration_min": 30,
            "agenda": "Acceptance review",
        },
    }
    meeting_response = client.post("/api/v1/mcp/execute", headers=headers(), json=meeting)
    assert meeting_response.status_code == 200
    event_id = meeting_response.get_json()["data"]["id"]
    assert any(
        event["id"] == event_id
        for event in client.get("/api/v1/calendar", headers=headers()).get_json()["events"]
    )
    assert count_rows(CalendarEvent) >= 4


def test_calendar_response_includes_day_aggregation(client):
    response = client.get("/api/v1/calendar?month=2026-11", headers=headers())

    assert response.status_code == 200
    body = response.get_json()
    assert "events" in body
    assert "days" in body
    assert body["days"]


def test_mcp_rejects_unconfirmed_and_intern_admin_or_foreign_access(client):
    payload = {
        "tool_name": "request_service_access",
        "idempotency_key": "qa-denied-admin",
        "confirmed": False,
        "payload": {"service_name": "jira", "project_key": "AUTO", "access_level": "admin"},
    }
    unconfirmed = client.post("/api/v1/mcp/execute", headers=headers(), json=payload)
    assert unconfirmed.status_code == 422
    assert unconfirmed.get_json()["error"] == "CONFIRMATION_REQUIRED"

    payload["confirmed"] = True
    admin = client.post("/api/v1/mcp/execute", headers=headers(), json=payload)
    assert admin.status_code == 403
    assert admin.get_json()["error"] == "RBAC_ROLE_DENIED"

    payload.update(
        idempotency_key="qa-denied-foreign",
        payload={"service_name": "jira", "project_key": "FIN-123", "access_level": "read"},
    )
    foreign = client.post("/api/v1/mcp/execute", headers=headers(), json=payload)
    assert foreign.status_code == 403
    assert foreign.get_json()["error"] == "ABAC_CLUSTER_DENIED"


def test_verify_mcp_contract_and_guardrail(client):
    verify = {
        "tool_name": "verify_onboarding_task",
        "idempotency_key": "qa-verify-1",
        "confirmed": True,
        "payload": {
            "node_id": "node_w1_intro",
            "artifact_type": "cli_log",
            "content": "avito-cli: OK",
        },
    }
    response = client.post("/api/v1/mcp/execute", headers=headers(), json=verify)
    assert response.status_code == 200
    assert response.get_json()["status"] == "done"

    verify["idempotency_key"] = "qa-verify-secret"
    verify["payload"]["content"] = "-----BEGIN OPENSSH PRIVATE KEY-----"
    blocked = client.post("/api/v1/mcp/execute", headers=headers(), json=verify)
    assert blocked.status_code == 422
    assert blocked.get_json()["error"] == "GUARDRAIL_SECRET_DETECTED"


def test_calendar_summary_uses_persisted_progress_and_pulse_blockers(client):
    client.post(
        "/api/v1/roadmap/nodes/node_w1_intro/verify",
        headers=headers(),
        json={"artifact_type": "cli_log", "content": "avito-cli: OK"},
    )
    client.post(
        "/api/v1/pulse",
        headers=headers(),
        json={"mood_score": 2, "blocker_tags": ["access"]},
    )

    summary = client.post(
        "/api/v1/calendar/summary", headers=headers(), json={"summary_type": "equator"}
    )
    assert summary.status_code == 200
    body = summary.get_json()
    assert body["kind"] == "equator"
    assert body["xp"] >= 165
    assert "access" in body["blocker_tags"]
    assert body["completed_nodes"]


def test_pulse_increments_consecutive_streak_and_is_persisted_once(client):
    with session_scope() as session:
        user = session.get(User, "usr_intern_1")
        user.last_pulse_date = date.today() - timedelta(days=1)
        user.streak_days = 3

    response = client.post(
        "/api/v1/pulse", headers=headers(), json={"mood_score": 5, "blocker_tags": []}
    )
    assert response.status_code == 201
    assert response.get_json()["streak_days"] == 4
    duplicate = client.post(
        "/api/v1/pulse", headers=headers(), json={"mood_score": 1, "blocker_tags": ["changed"]}
    )
    assert duplicate.status_code == 200
    assert duplicate.get_json()["xp_awarded"] == 0
    assert count_rows(UserNodeProgress) == len(NODES)
