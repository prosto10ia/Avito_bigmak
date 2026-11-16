from flask import g


def deny(error: str, status: int = 403):
    return error, status


def can_read_chunk(user, chunk) -> bool:
    return user.role in (chunk.allowed_roles or []) and (
        chunk.source_scope == "playbook_global" or chunk.cluster == user.cluster
    )


def assert_project_access(user, project_key: str, access_level: str):
    # Synthetic project convention used by the offline demo.
    if user.role == "intern" and access_level == "admin":
        return deny("RBAC_ROLE_DENIED")
    if project_key.upper().startswith(("FIN", "REAL")) and user.cluster not in (
        "Fintech",
        "RealEstate",
    ):
        return deny("ABAC_CLUSTER_DENIED")
    return None


def stored_user():
    return g.user
