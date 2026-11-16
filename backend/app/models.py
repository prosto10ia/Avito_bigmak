from datetime import date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32))
    job_title: Mapped[str] = mapped_column(String(80))
    team: Mapped[str] = mapped_column(String(80))
    cluster: Mapped[str] = mapped_column(String(80))
    mentor_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("users.id"))
    manager_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("users.id"))
    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    streak_days: Mapped[int] = mapped_column(Integer, default=1)
    last_pulse_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RoadmapNode(Base):
    __tablename__ = "roadmap_nodes"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    period: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    node_type: Mapped[str] = mapped_column(String(32))
    xp_reward: Mapped[int] = mapped_column(Integer, default=50)
    order_index: Mapped[int] = mapped_column(Integer)
    target_role: Mapped[str] = mapped_column(String(32), default="intern")
    verification_config: Mapped[dict] = mapped_column(JSON, default=dict)
    depends_on_node_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("roadmap_nodes.id")
    )


class UserNodeProgress(Base):
    __tablename__ = "user_node_progress"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    node_id: Mapped[str] = mapped_column(String(64), ForeignKey("roadmap_nodes.id"))
    status: Mapped[str] = mapped_column(String(32))
    verified_artifact: Mapped[str | None] = mapped_column(Text)
    verification_feedback: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "node_id"),)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    participant_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(160))
    event_type: Mapped[str] = mapped_column(String(32))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    duration_min: Mapped[int] = mapped_column(Integer, default=30)
    agenda: Mapped[str | None] = mapped_column(Text)
    auto_summary: Mapped[str | None] = mapped_column(Text)


class ServiceRequest(Base):
    __tablename__ = "service_requests"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    tool_name: Mapped[str] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32))
    external_ticket_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DailyPulse(Base):
    __tablename__ = "daily_pulses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    pulse_date: Mapped[date] = mapped_column(Date, default=date.today)
    mood_score: Mapped[int] = mapped_column(Integer)
    blocker_tags: Mapped[list] = mapped_column(JSON, default=list)
    comment: Mapped[str | None] = mapped_column(Text)
    xp_awarded: Mapped[int] = mapped_column(Integer, default=15)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "pulse_date"),)


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    doc_title: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(String(300))
    source_scope: Mapped[str] = mapped_column(String(32))
    cluster: Mapped[str | None] = mapped_column(String(80))
    allowed_roles: Mapped[list] = mapped_column(
        JSON().with_variant(ARRAY(String), "postgresql"), default=list
    )
    topic_key: Mapped[str] = mapped_column(String(80))
    version_date: Mapped[date] = mapped_column(Date)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list | None] = mapped_column(JSON)


class ClickstreamEvent(Base):
    __tablename__ = "clickstream_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(32))
    event_name: Mapped[str] = mapped_column(String(80))
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
