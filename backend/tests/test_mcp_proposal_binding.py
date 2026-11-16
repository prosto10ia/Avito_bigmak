import pytest

from seed import seed


def headers():
    return {
        "X-Demo-Access-Code": "hack-and-change-2026",
        "X-User-Id": "usr_intern_1",
        "X-User-Role": "intern",
    }


@pytest.fixture()
def client(tmp_path):
    from app import create_app

    app = create_app({"TESTING": True, "DATABASE_URL": f"sqlite:///{tmp_path / 'proposal.db'}"})
    seed()
    return app.test_client()


def test_mcp_requires_matching_chat_proposal(client):
    direct = client.post(
        "/api/v1/mcp/execute",
        headers=headers(),
        json={
            "tool_name": "schedule_calendar_meeting",
            "idempotency_key": "unproposed-meeting",
            "confirmed": True,
            "payload": {
                "participant_id": "usr_buddy_1",
                "title": "Direct call",
                "datetime": "2026-11-25T10:00:00+00:00",
                "duration_min": 30,
                "agenda": "Should be rejected",
            },
        },
    )
    assert direct.status_code == 422
    assert direct.get_json()["error"] == "PROPOSAL_REQUIRED"

    proposal_response = client.post(
        "/api/v1/chat/message",
        headers=headers(),
        json={"message": "Запиши меня на встречу с buddy"},
    )
    action = proposal_response.get_json()["proposed_mcp_action"]
    confirmed = {
        "tool_name": action["tool_name"],
        "idempotency_key": action["idempotency_key"],
        "confirmed": True,
        "payload": action["payload"],
    }
    first = client.post("/api/v1/mcp/execute", headers=headers(), json=confirmed)
    replay = client.post("/api/v1/mcp/execute", headers=headers(), json=confirmed)
    assert first.status_code == replay.status_code == 200
    assert first.get_json() == replay.get_json()

    tampered = dict(confirmed, payload={**confirmed["payload"], "title": "Tampered"})
    rejected = client.post("/api/v1/mcp/execute", headers=headers(), json=tampered)
    assert rejected.status_code == 422
    assert rejected.get_json()["error"] == "PROPOSAL_REQUIRED"


def test_mcp_execute_does_not_expose_roadmap_verification(client):
    response = client.post(
        "/api/v1/mcp/execute",
        headers=headers(),
        json={
            "tool_name": "verify_onboarding_task",
            "idempotency_key": "direct-verify",
            "confirmed": True,
            "payload": {
                "node_id": "node_w1_intro",
                "artifact_type": "cli_log",
                "content": "avito-cli: OK",
            },
        },
    )
    assert response.status_code == 422
    assert response.get_json()["error"] == "INVALID_REQUEST"
