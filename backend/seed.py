from datetime import date, datetime, timedelta

from sqlalchemy import select

from app import db
from app.models import (
    Base,
    CalendarEvent,
    KnowledgeChunk,
    RoadmapNode,
    User,
    UserNodeProgress,
)

USERS = [
    dict(
        id="usr_intern_1",
        full_name="Иван Петров",
        role="intern",
        job_title="Стажёр-разработчик",
        team="Auto Platform",
        cluster="Auto",
        xp=120,
        level=2,
        streak_days=3,
    ),
    dict(
        id="usr_buddy_1",
        full_name="Анна Смирнова",
        role="buddy",
        job_title="Buddy",
        team="Auto Platform",
        cluster="Auto",
    ),
    dict(
        id="usr_manager_1",
        full_name="Олег Волков",
        role="manager",
        job_title="Руководитель команды",
        team="Auto Platform",
        cluster="Auto",
    ),
]
NODES = [
    (
        "node_w1_intro",
        "week_1",
        "Знакомство с командой",
        "Познакомиться с командой и процессами.",
        "guide",
        30,
        1,
        None,
    ),
    (
        "node_w1_cli",
        "week_1",
        "Проверить avito-cli",
        "Запустить CLI и приложить лог.",
        "service_action",
        50,
        2,
        "node_w1_intro",
    ),
    (
        "node_w1_obs",
        "week_1",
        "Наблюдаемость",
        "Ответить на вопросы по Grafana и Sentry.",
        "quiz",
        50,
        3,
        "node_w1_cli",
    ),
    (
        "node_m1_access",
        "month_1",
        "Доступы к сервисам",
        "Оформить минимально необходимые доступы.",
        "service_action",
        70,
        4,
        "node_w1_obs",
    ),
    (
        "node_m2_pulse",
        "month_2",
        "Первый Daily Pulse",
        "Заполнить вечерний чек-ин.",
        "guide",
        40,
        5,
        "node_m1_access",
    ),
    (
        "node_equator",
        "equator",
        "Подготовка к Экватору",
        "Собрать результаты адаптации.",
        "quiz",
        100,
        6,
        "node_m2_pulse",
    ),
    (
        "node_w2_pairing",
        "week_2",
        "Парное ревью",
        "Провести первое парное ревью.",
        "guide",
        40,
        7,
        "node_w1_intro",
    ),
    (
        "node_w2_quiz",
        "week_2",
        "Карта команды",
        "Ответить на вопросы о владельцах сервисов.",
        "quiz",
        40,
        8,
        "node_w2_pairing",
    ),
    (
        "node_m1_arch",
        "month_1",
        "Архитектурный контекст",
        "Разобрать контур продукта с buddy.",
        "guide",
        60,
        9,
        "node_w1_obs",
    ),
    (
        "node_m2_feedback",
        "month_2",
        "Обратная связь",
        "Собрать обратную связь за первый месяц.",
        "guide",
        40,
        10,
        "node_m1_access",
    ),
    (
        "node_m3_ownership",
        "month_3",
        "Зона ответственности",
        "Зафиксировать первый самостоятельный участок.",
        "service_action",
        70,
        11,
        "node_m2_pulse",
    ),
    (
        "node_m3_quiz",
        "month_3",
        "Практика эксплуатации",
        "Проверить сценарии поддержки.",
        "quiz",
        70,
        12,
        "node_m3_ownership",
    ),
    (
        "node_equator_demo",
        "equator",
        "Демо результата",
        "Подготовить короткое демо результата.",
        "guide",
        80,
        13,
        "node_m2_pulse",
    ),
    (
        "node_equator_review",
        "equator",
        "Ретро адаптации",
        "Сформулировать следующие шаги после Экватора.",
        "quiz",
        80,
        14,
        "node_equator_demo",
    ),
]


def seed() -> None:
    Base.metadata.create_all(db.engine)
    with db.session_scope() as session:
        for values in USERS:
            user = session.get(User, values["id"])
            if user is None:
                session.add(User(**values))
        session.flush()
        intern = session.get(User, "usr_intern_1")
        intern.mentor_id = "usr_buddy_1"
        intern.manager_id = "usr_manager_1"
        for (
            node_id,
            period,
            title,
            description,
            node_type,
            xp,
            order_index,
            depends_on,
        ) in NODES:
            if session.get(RoadmapNode, node_id) is None:
                session.add(
                    RoadmapNode(
                        id=node_id,
                        period=period,
                        title=title,
                        description=description,
                        node_type=node_type,
                        xp_reward=xp,
                        order_index=order_index,
                        target_role="intern",
                        verification_config={},
                        depends_on_node_id=depends_on,
                    )
                )
        session.flush()
        for node_id, *_ in NODES:
            exists = session.scalar(
                select(UserNodeProgress).where(
                    UserNodeProgress.user_id == "usr_intern_1",
                    UserNodeProgress.node_id == node_id,
                )
            )
            if exists is None:
                session.add(
                    UserNodeProgress(
                        user_id="usr_intern_1",
                        node_id=node_id,
                        status="active" if node_id == NODES[0][0] else "locked",
                    )
                )
        if session.get(CalendarEvent, "event_welcome_1") is None:
            session.add(
                CalendarEvent(
                    id="event_welcome_1",
                    user_id="usr_intern_1",
                    participant_id="usr_buddy_1",
                    title="1:1 с buddy",
                    event_type="one_on_one",
                    starts_at=datetime.utcnow() + timedelta(days=1),
                    duration_min=30,
                    agenda="Первые вопросы и план на неделю",
                )
            )
        extra_events = [
            ("event_team_sync_1", "Синк команды", "team_sync", 2, "Статус адаптации"),
            ("event_deadline_1", "Дедлайн CLI", "deadline", 5, "Закрыть первый шаг адаптации"),
            (
                "event_equator_1",
                "Экватор адаптации",
                "equator_defense",
                14,
                "Демо и обратная связь",
            ),
        ]
        for event_id, title, event_type, days_ahead, agenda in extra_events:
            if session.get(CalendarEvent, event_id) is None:
                session.add(
                    CalendarEvent(
                        id=event_id,
                        user_id="usr_intern_1",
                        participant_id="usr_buddy_1",
                        title=title,
                        event_type=event_type,
                        starts_at=datetime.utcnow() + timedelta(days=days_ahead),
                        duration_min=45,
                        agenda=agenda,
                    )
                )
        knowledge = [
            (
                "kb_auto_staging",
                "Auto Playbook",
                "https://demo.invalid/playbook/auto",
                "cluster_specific",
                "Auto",
                "deploy_branch_policy",
                "В Auto на staging ветки выкатываются через заявку в CI.",
            ),
            (
                "kb_global_staging",
                "AvitoTech Playbook",
                "https://demo.invalid/playbook/global",
                "playbook_global",
                None,
                "deploy_branch_policy",
                "Глобальное правило: перед staging нужен review.",
            ),
            (
                "kb_fintech_restricted",
                "Fintech Playbook",
                "https://demo.invalid/playbook/fintech",
                "cluster_specific",
                "Fintech",
                "deploy_branch_policy",
                "В Fintech для staging нужен дополнительный security review.",
            ),
            (
                "kb_hr_restricted",
                "HR Confidential Playbook",
                "https://demo.invalid/playbook/hr",
                "playbook_global",
                None,
                "hr_confidential",
                "Закрытая HR-информация доступна только руководителям.",
            ),
        ]
        for item in knowledge:
            allowed_roles = (
                ["manager"] if item[0] == "kb_hr_restricted" else ["intern", "buddy", "manager"]
            )
            if session.get(KnowledgeChunk, item[0]) is None:
                session.add(
                    KnowledgeChunk(
                        id=item[0],
                        doc_title=item[1],
                        source_url=item[2],
                        source_scope=item[3],
                        cluster=item[4],
                        allowed_roles=allowed_roles,
                        topic_key=item[5],
                        version_date=date(2026, 1, 1),
                        content=item[6],
                    )
                )


if __name__ == "__main__":
    seed()
    print("Seed complete")
