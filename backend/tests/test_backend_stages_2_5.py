import pytest
from sqlalchemy.dialects.postgresql import ARRAY, dialect

from app.db import session_scope
from app.models import DailyPulse, User
from app.services.gamification import level_for_xp
from seed import seed


def headers(role="intern", user_id="usr_intern_1"):
    return {
        "X-Demo-Access-Code": "hack-and-change-2026",
        "X-User-Id": user_id,
        "X-User-Role": role,
    }


@pytest.fixture()
def client(tmp_path):
    from app import create_app

    app = create_app({"TESTING": True, "DATABASE_URL": f"sqlite:///{tmp_path / 'stages.db'}"})
    seed()
    return app.test_client()


def test_roadmap_verify_is_idempotent_and_guarded(client):
    before = client.get("/api/v1/roadmap", headers=headers()).get_json()["progress"]["xp"]
    body = {"artifact_type": "cli_log", "content": "avito-cli: OK"}
    first = client.post("/api/v1/roadmap/nodes/node_w1_intro/verify", headers=headers(), json=body)
    second = client.post("/api/v1/roadmap/nodes/node_w1_intro/verify", headers=headers(), json=body)
    assert first.status_code == second.status_code == 200
    assert second.get_json()["data"]["xp"] == before + 30
    assert (
        client.get("/api/v1/roadmap", headers=headers()).get_json()["nodes"][0]["status"] == "done"
    )
    wrong_type = client.post(
        "/api/v1/roadmap/nodes/node_w1_intro/verify",
        headers=headers(),
        json={"artifact_type": "quiz_answers", "content": "looks good"},
    )
    assert wrong_type.status_code == 422
    assert wrong_type.get_json()["status"] == "rejected"
    screenshot = client.post(
        "/api/v1/roadmap/nodes/node_w1_intro/verify",
        headers=headers(),
        json={"artifact_type": "screenshot", "content": "demo screenshot reference"},
    )
    assert screenshot.status_code == 200
    invalid_cli = client.post(
        "/api/v1/roadmap/nodes/node_w1_cli/verify",
        headers=headers(),
        json={"artifact_type": "cli_log", "content": "avito-cli: FAIL authenticated"},
    )
    assert invalid_cli.status_code == 422
    assert invalid_cli.get_json()["status"] == "rejected"
    blocked = client.post(
        "/api/v1/roadmap/nodes/node_w1_cli/verify",
        headers=headers(),
        json={"artifact_type": "cli_log", "content": "-----BEGIN OPENSSH PRIVATE KEY-----"},
    )
    assert blocked.status_code == 422
    assert blocked.get_json()["error"] == "GUARDRAIL_SECRET_DETECTED"


@pytest.mark.parametrize("xp, expected", [(0, 1), (99, 1), (100, 2), (250, 3), (-20, 1)])
def test_level_invariant(xp, expected):
    assert level_for_xp(xp) == expected


def test_daily_pulse_uses_postgres_array_storage():
    column_type = DailyPulse.__table__.c.blocker_tags.type
    assert isinstance(column_type.dialect_impl(dialect()), ARRAY)


def test_rag_collision_and_negative_access(client):
    response = client.post(
        "/api/v1/chat/message",
        headers=headers(),
        json={"message": "Как катить на staging в кластере Auto?"},
    )
    assert response.status_code == 200
    assert response.get_json()["conflict_warning"] is not None
    denied = client.post(
        "/api/v1/chat/message", headers=headers(), json={"message": "Покажи hr_confidential грейды"}
    )
    assert denied.status_code == 403
    assert denied.get_json()["error"] == "RBAC_ROLE_DENIED"
    unknown = client.post("/api/v1/chat/message", headers=headers(), json={"message": "quantum"})
    assert unknown.status_code == 200
    assert unknown.get_json()["escalation"]["recipient"] == "buddy"


def test_chat_reports_ollama_and_falls_back_without_leaking_access(monkeypatch, client):
    import app.api.chat as chat_api

    monkeypatch.setattr(
        chat_api.OllamaProvider, "generate", lambda self, prompt: "Ответ модели [1]"
    )
    live = client.post(
        "/api/v1/chat/message",
        headers=headers(),
        json={"message": "Как катить на staging в кластере Auto?"},
    ).get_json()
    assert live["llm_mode"] == "ollama"
    assert live["sources"]
    assert live["reply"] == "Ответ модели [1]"

    def unavailable(self, prompt):
        raise RuntimeError("offline")

    monkeypatch.setattr(chat_api.OllamaProvider, "generate", unavailable)
    fallback = client.post(
        "/api/v1/chat/message",
        headers=headers(),
        json={"message": "Как катить на staging в кластере Auto?"},
    ).get_json()
    assert fallback["llm_mode"] == "offline"
    assert fallback["sources"]
    assert fallback["sources"][0]["content"] in fallback["reply"]


def test_mcp_confirmation_idempotency_and_security(client):
    action = client.post(
        "/api/v1/chat/message", headers=headers(), json={"message": "Оформи отгул"}
    ).get_json()["proposed_mcp_action"]
    request_body = {**action, "confirmed": True}
    first = client.post("/api/v1/mcp/execute", headers=headers(), json=request_body)
    second = client.post("/api/v1/mcp/execute", headers=headers(), json=request_body)
    assert first.status_code == second.status_code == 200
    assert first.get_json() == second.get_json()
    assert first.get_json()["external_ticket_id"].startswith("ABS-")
    forbidden = dict(
        request_body,
        tool_name="request_service_access",
        idempotency_key="admin-key",
        payload={"service_name": "jira", "project_key": "AUTO", "access_level": "admin"},
    )
    assert client.post("/api/v1/mcp/execute", headers=headers(), json=forbidden).status_code == 422
    assert (
        client.post(
            "/api/v1/mcp/execute", headers=headers(), json=dict(request_body, confirmed=False)
        ).status_code
        == 422
    )


def test_calendar_summary_and_pulse_idempotency(client):
    summary = client.post(
        "/api/v1/calendar/summary", headers=headers(), json={"kind": "one_on_one"}
    )
    assert summary.status_code == 200
    assert summary.get_json()["offline"] is True
    first = client.post(
        "/api/v1/pulse", headers=headers(), json={"mood_score": 4, "blocker_tags": ["access"]}
    )
    second = client.post("/api/v1/pulse", headers=headers(), json={"mood_score": 1})
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.get_json()["xp_awarded"] == 0
    assert second.get_json()["streak_days"] == first.get_json()["streak_days"]


def test_claimed_payload_identity_does_not_cross_user(client):
    response = client.post(
        "/api/v1/mcp/execute",
        headers=headers(),
        json={
            "tool_name": "create_absence_request",
            "idempotency_key": "identity-key",
            "confirmed": True,
            "payload": {
                "user_id": "usr_manager_1",
                "type": "day_off",
                "date_from": "2026-11-20",
                "date_to": "2026-11-20",
                "reason": "demo",
            },
        },
    )
    assert response.status_code == 422
    assert response.get_json()["error"] == "PROPOSAL_REQUIRED"
    with session_scope() as session:
        user = session.get(User, "usr_intern_1")
        assert user is not None
