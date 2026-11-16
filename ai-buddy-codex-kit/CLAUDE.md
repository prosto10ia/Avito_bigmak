# CLAUDE.md — Корневой манифест проекта AI-buddy (Avito Start)

## 1. Источник истины (Single Source of Truth)
Перед выполнением любой задачи обязательно прочитай:
1. `tech.md` — замороженное архитектурное ядро (схема БД PostgreSQL + pgvector, контракты REST API и 4 MCP-инструментов, общие TypeScript/Zod схемы, матрица RBAC/ABAC и Guardrails).
2. `/specs/openapi.yaml`, `/specs/mcp-tools.yaml`, `/specs/agent-behavior.yaml` — SDD-спецификации агента и инструментов.
3. Файл своей роли (`LEAD.md`, `DEV_A.md` или `DEV_B.md`).

## 2. Железное правило контрактов (CONTRACT GAP)
Тебе строго запрещено выдумывать новые поля таблиц, эндпоинты REST API, сигнатуры MCP-тулов или менять общие типы в `frontend/src/types/domain.ts` и `backend/app/schemas.py`.
Если для решения задачи не хватает контракта в `tech.md`:
1. Останови написание кода.
2. Выведи блок `CONTRACT GAP` (что именно нужно, для какого слайса, предлагаемая схема запроса/ответа).
3. Дождись обновления `tech.md` тимлидом.

## 3. Команды разработки, проверки типов и покрытия тестами (> 80%)
- **Запуск всего стенда:**
  `docker compose up --build -d`
- **Backend — тесты и проверка порога покрытия > 80%:**
  `cd backend && pytest --cov=app --cov-report=term-missing --cov-report=xml:coverage.xml --cov-fail-under=80`
- **Backend — линтер:**
  `cd backend && ruff check .`
- **Frontend — тайпчек и линтер:**
  `cd frontend && npm run typecheck && npm run lint`
- **Frontend — тесты и проверка порога покрытия > 80%:**
  `cd frontend && npm run test:coverage`

## 4. Обязательные требования кейса Авито при написании кода
1. **Оффлайн-режим для жюри:** любой AI/RAG и MCP сценарий обязан работать на 100% при пустом `LLM_API_KEY` за счёт детерминированного `OfflineMockLLM` в `backend/app/services/llm_provider.py`. Демо-код доступа: `hack-and-change-2026`.
2. **Отклик < 1 сек:** чтения дорожной карты и дашборда кэшируются в Redis и инвалидируются при мутациях.
3. **Безопасность (RBAC/ABAC & Guardrails):** стажёр получает `403 Forbidden` при запросе данных чужого кластера или HR-конфиденциальных чанков. Приватные SSH-ключи (`BEGIN OPENSSH PRIVATE KEY`) и токены перехватываются локальным Regex-фильтром (`422 Unprocessable Entity`) до вызова LLM.
4. **Дисциплина коммитов:** делай атомарные коммиты на английском языке в формате `type(scope): summary` (`feat|fix|test|refactor|chore|docs`, до 50 символов, без точки). Интерфейс и демо-данные — на русском языке.
