import json

from app.services import llm_provider
from app.services.llm_provider import OllamaProvider


class _Response:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({"message": {"content": "Локальный ответ [1]"}}).encode()


def test_ollama_provider_posts_local_chat_options(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        captured["body"] = json.loads(request.data)
        return _Response()

    monkeypatch.setattr(llm_provider, "urlopen", fake_urlopen)
    result = OllamaProvider("http://host.docker.internal:11434", "qwen2.5:3b", 180).generate(
        "Вопрос"
    )

    assert result == "Локальный ответ [1]"
    assert captured["url"].endswith("/api/chat")
    assert captured["timeout"] == 180
    assert captured["body"]["model"] == "qwen2.5:3b"
    assert captured["body"]["stream"] is False
    assert captured["body"]["options"] == {
        "temperature": 0.2,
        "num_ctx": 4096,
        "num_predict": 384,
    }


def test_ollama_provider_rejects_non_local_host():
    try:
        OllamaProvider("https://api.example.com", "qwen2.5:3b")
    except ValueError as exc:
        assert "local Ollama" in str(exc)
    else:
        raise AssertionError("remote Ollama host must be rejected")
