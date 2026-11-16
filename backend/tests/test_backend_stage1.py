import pytest

from app import create_app
from app.db import session_scope
from app.models import ClickstreamEvent
from seed import seed


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_url = f"sqlite:///{tmp_path / 'test.db'}"
    app = create_app(
        {"TESTING": True, "DATABASE_URL": db_url, "DEMO_ACCESS_CODE": "hack-and-change-2026"}
    )

    seed()
    yield app.test_client()


def headers(role="intern", user_id="usr_intern_1", code="hack-and-change-2026"):
    return {"X-Demo-Access-Code": code, "X-User-Id": user_id, "X-User-Role": role}


def test_health_and_dashboard(client):
    assert client.get("/health").get_json()["status"] == "ok"
    response = client.get("/api/v1/dashboard", headers=headers())
    assert response.status_code == 200
    assert response.get_json()["profile"]["id"] == "usr_intern_1"
    payload = response.get_json()
    assert {"mentor_name", "manager_name", "mascot_stage", "pulse_completed_today"} <= payload[
        "profile"
    ].keys()
    assert {
        "description",
        "node_type",
        "xp_reward",
        "order_index",
        "verification_config",
    } <= payload["active_nodes"][0].keys()
    assert {"upcoming_events", "pulse"} <= payload.keys()


def test_auth_rejects_claimed_role_mismatch_and_code(client):
    assert client.get("/api/v1/dashboard", headers=headers(role="manager")).status_code == 403
    assert (
        client.get("/api/v1/dashboard", headers=headers(code="wrong")).get_json()["error"]
        == "INVALID_DEMO_ACCESS_CODE"
    )


def test_switch_role_uses_seeded_identity(client):
    response = client.post(
        "/api/v1/auth/switch-role", headers=headers(), json={"target_role": "manager"}
    )
    assert response.status_code == 200
    assert response.get_json()["id"] == "usr_manager_1"


def test_telemetry_persists_and_blocks_secrets(client):
    response = client.post(
        "/api/v1/telemetry",
        headers=headers(),
        json={"event_name": "tab_open", "metadata": {"tab": "home"}},
    )
    assert response.status_code == 201
    with session_scope() as session:
        assert session.query(ClickstreamEvent).count() == 1
    response = client.post(
        "/api/v1/telemetry",
        headers=headers(),
        json={"event_name": "bad", "metadata": {"value": "-----BEGIN OPENSSH PRIVATE KEY-----"}},
    )
    assert response.status_code == 422
