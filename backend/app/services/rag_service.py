from datetime import date

from sqlalchemy import select

from ..middleware.rbac import can_read_chunk
from ..models import KnowledgeChunk

TERM_ALIASES = {
    "окружение": {"окружение", "настройка", "установка", "setup", "environment", "ноутбук"},
    "cli": {"cli", "команд", "терминал", "консоль", "avito-cli"},
    "git": {"git", "ветк", "коммит", "merge", "ревью", "pull", "push"},
    "jira": {"jira", "задач", "тикет", "доступ"},
    "stash": {"stash", "репозитор", "ssh", "код"},
    "grafana": {"grafana", "метрик", "дашборд", "мониторинг"},
    "sentry": {"sentry", "ошибк", "исключен", "логирован"},
    "неделя": {"недел", "адаптац", "онбординг", "стажировк"},
    "процесс": {"процесс", "синк", "встреч", "команд", "согласован"},
    "экватор": {"экватор", "итог", "обратн", "результат"},
    "безопасность": {"безопас", "security", "секрет", "доступ", "приватн"},
}
ALIAS_TO_CANONICAL = {
    alias: canonical for canonical, aliases in TERM_ALIASES.items() for alias in aliases
}
RUSSIAN_ENDINGS = (
    "иями",
    "ами",
    "ями",
    "ого",
    "ему",
    "ами",
    "ов",
    "ев",
    "ах",
    "ях",
    "ы",
    "и",
    "а",
    "я",
    "у",
    "ю",
    "ом",
    "ем",
    "е",
)


def _terms(text: str) -> set[str]:
    terms = set()
    for raw_word in text.lower().replace("ё", "е").split():
        word = raw_word.strip(".,!?():;\"'«»—–")
        if len(word) <= 2:
            continue
        terms.add(word)
        terms.add(ALIAS_TO_CANONICAL.get(word, word))
        for ending in RUSSIAN_ENDINGS:
            if word.endswith(ending) and len(word) - len(ending) >= 4:
                terms.add(word[: -len(ending)])
                break
    expanded = set(terms)
    for canonical, aliases in TERM_ALIASES.items():
        if terms & {canonical, *aliases}:
            expanded.update(aliases)
            expanded.add(canonical)
    return expanded


def search(session, user, question: str):
    terms = _terms(question)
    chunks = [c for c in session.scalars(select(KnowledgeChunk)).all() if can_read_chunk(user, c)]
    ranked = sorted(
        ((len(terms & _terms(c.content + " " + c.doc_title)), c) for c in chunks),
        key=lambda item: item[0],
        reverse=True,
    )
    return [(score, chunk) for score, chunk in ranked if score > 0]


def collision_warning(matches):
    by_topic = {}
    for _, chunk in matches:
        by_topic.setdefault(chunk.topic_key, []).append(chunk)
    for topic, chunks in by_topic.items():
        global_docs = [c for c in chunks if c.source_scope == "playbook_global"]
        cluster_docs = [c for c in chunks if c.source_scope == "cluster_specific"]
        if (
            global_docs
            and cluster_docs
            and {c.content for c in global_docs} != {c.content for c in cluster_docs}
        ):
            latest = max(cluster_docs, key=lambda c: c.version_date or date.min)
            return {
                "topic_key": topic,
                "summary": "Правило кластера новее и имеет приоритет.",
                "playbook_claim": global_docs[0].content,
                "cluster_claim": latest.content,
                "recommended_source_url": latest.source_url,
                "priority_source": latest.source_url,
            }
    return None


def escalation(question: str, user):
    lowered = question.lower()
    recipient = (
        "hr_bp"
        if any(x in lowered for x in ("зарплат", "отпуск", "кадр", "грейд"))
        else ("manager" if any(x in lowered for x in ("процесс", "соглас", "доступ")) else "buddy")
    )
    target_name = {
        "buddy": "Анна Смирнова",
        "manager": "Олег Волков",
        "hr_bp": "HR BP демо",
    }[recipient]
    return {
        "target_role": recipient,
        "recipient": recipient,
        "target_name": target_name,
        "mattermost_handle": {
            "buddy": "anna.smirnova",
            "manager": "oleg.volkov",
            "hr_bp": "hr.bp.demo",
        }[recipient],
        "draft_message": f"Привет! Я {user.full_name}, кластер {user.cluster}. Помоги разобраться: {question}",
    }
