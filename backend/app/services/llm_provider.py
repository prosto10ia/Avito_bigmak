import hashlib
import json
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class OllamaProvider:
    """Local-only Ollama chat provider; failures are handled by the caller."""

    def __init__(self, base_url: str, model: str, timeout: float = 180.0):
        parsed = urlparse(base_url)
        if parsed.hostname not in {"localhost", "127.0.0.1", "::1", "host.docker.internal"}:
            raise ValueError("OllamaProvider accepts local Ollama hosts only")
        self.endpoint = base_url.rstrip("/") + "/api/chat"
        self.model = model
        self.timeout = timeout

    def generate(self, prompt: str, **_: object) -> str:
        body = {
            "model": self.model,
            "stream": False,
            "messages": [{"role": "user", "content": prompt}],
            "options": {
                "temperature": 0.2,
                "num_ctx": 4096,
                "num_predict": 384,
            },
        }
        request = Request(
            self.endpoint,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
        except (OSError, URLError, ValueError, json.JSONDecodeError) as exc:
            raise RuntimeError("Ollama is unavailable") from exc
        answer = result.get("message", {}).get("content")
        if not isinstance(answer, str) or not answer.strip():
            raise RuntimeError("Ollama returned an empty answer")
        return answer.strip()


class OfflineMockLLM:
    """Deterministic local provider used whenever no LLM credential is configured."""

    def generate(self, prompt: str, **_: object) -> str:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:8]
        return "OFFLINE_DEMO: deterministic response for " + digest
