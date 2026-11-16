import re


def ticket(prefix: str, request_id: str) -> str:
    return f"{prefix}-2026-{request_id[-6:].upper()}"


def absence(request_id: str):
    return ticket("ABS", request_id)


def access(request_id: str):
    return ticket("ACC", request_id)


def simulated_calendar():
    return "offline-calendar"


def validate_artifact(artifact_type: str, content: str) -> tuple[bool, str]:
    lowered = content.lower()
    if artifact_type == "cli_log":
        cli_ok = re.search(r"(?m)^\s*avito-cli\s*:\s*ok\s*$", lowered)
        ssh_ok = re.search(r"(?m)^\s*stash_ssh\s*:\s*authenticated\s*$", lowered)
        failed = re.search(r"\b(?:fail|failed|not\s+ok|error)\b", lowered)
        ok = bool(cli_ok or ssh_ok) and failed is None
        return ok, "CLI log validated" if ok else "Expected avito-cli and OK/authenticated"
    if artifact_type == "quiz_answers":
        required = ("grafana", "sentry", "шаталити")
        ok = all(word in lowered for word in required)
        return (
            ok,
            "Observability quiz validated"
            if ok
            else "Expected Grafana, Sentry and Шаталити answers",
        )
    return bool(content.strip()), "Artifact accepted"
