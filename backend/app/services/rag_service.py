from datetime import date

from sqlalchemy import select

from ..middleware.rbac import can_read_chunk
from ..models import KnowledgeChunk


def _terms(text: str) -> set[str]:
    return {word.lower().strip(".,!?():;") for word in text.split() if len(word) > 2}


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
