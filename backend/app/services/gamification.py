from datetime import datetime

from sqlalchemy import select

from ..models import RoadmapNode, User, UserNodeProgress


def level_for_xp(xp: int) -> int:
    return 1 + max(0, xp) // 100


def complete_node(session, user: User, node: RoadmapNode, artifact: str, feedback: str):
    progress = session.scalar(
        select(UserNodeProgress)
        .where(UserNodeProgress.user_id == user.id, UserNodeProgress.node_id == node.id)
        .with_for_update()
    )
    if progress is None:
        progress = UserNodeProgress(
            user_id=user.id,
            node_id=node.id,
            status="active" if node.depends_on_node_id is None else "locked",
        )
        session.add(progress)
        session.flush()
    if progress.status == "locked":
        return progress, False
    awarded = progress.status != "done"
    if awarded:
        progress.status = "done"
        progress.verified_artifact = artifact
        progress.verification_feedback = feedback
        user.xp = max(0, user.xp) + max(0, node.xp_reward)
        user.level = level_for_xp(user.xp)
        for dependent in session.scalars(
            select(RoadmapNode).where(RoadmapNode.depends_on_node_id == node.id)
        ):
            child = session.scalar(
                select(UserNodeProgress).where(
                    UserNodeProgress.user_id == user.id,
                    UserNodeProgress.node_id == dependent.id,
                )
            )
            if child and child.status == "locked":
                child.status = "active"
    progress.updated_at = datetime.utcnow()
    return progress, awarded
