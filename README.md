# Avito_bigmak

## Local AI mode

AI-buddy uses Ollama locally without cloud APIs or API keys. Install Ollama for Apple
Silicon, start it natively, then load the demo model:

```bash
ollama serve
ollama pull qwen2.5:3b
docker compose up -d --build
```

The backend reaches Ollama only through `host.docker.internal:11434`; Ollama is not
published by Compose. Configure `OLLAMA_BASE_URL`, `OLLAMA_MODEL` and
`OLLAMA_TIMEOUT_SECONDS` in `.env`. If the local model is unavailable, chat visibly
uses the deterministic offline RAG fallback and keeps citations, RBAC and confirmation
guardrails.
