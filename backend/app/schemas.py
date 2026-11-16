from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SwitchRoleRequest(BaseModel):
    target_role: Literal["intern", "buddy", "manager"]


class TelemetryEventRequest(BaseModel):
    event_name: str = Field(min_length=1, max_length=80)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    role: str
    job_title: str
    team: str
    cluster: str
    xp: int
    level: int
    streak_days: int


class VerifyNodeRequest(BaseModel):
    artifact_type: Literal["cli_log", "screenshot", "quiz_answers"]
    content: str = Field(min_length=1, max_length=20000)


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ExecuteMCPRequest(BaseModel):
    tool_name: Literal[
        "create_absence_request",
        "request_service_access",
        "schedule_calendar_meeting",
    ]
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=1, max_length=128)
    confirmed: bool = False


class PulseRequest(BaseModel):
    mood_score: int = Field(ge=1, le=5)
    blocker_tags: list[str] = Field(default_factory=list, max_length=20)
    comment: str | None = Field(default=None, max_length=2000)


class SummaryRequest(BaseModel):
    kind: Literal["one_on_one", "equator"] = "one_on_one"
    summary_type: Literal["one_on_one", "equator"] | None = None

    @property
    def effective_kind(self) -> Literal["one_on_one", "equator"]:
        return self.summary_type or self.kind
