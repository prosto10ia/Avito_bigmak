import hashlib


class OfflineMockLLM:
    """Deterministic local provider used whenever no LLM credential is configured."""

    def generate(self, prompt: str, **_: object) -> str:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:8]
        return "OFFLINE_DEMO: deterministic response for " + digest
