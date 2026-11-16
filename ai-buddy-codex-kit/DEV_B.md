# DEV_B.md — Инструкция Разработчика B (Backend API, Контекстный RAG, Детектор коллизий, MCP-сервер, Безопасность)

## ПРОЧИТАЙ ПЕРВЫМ
1. Прочитай `tech.md` и спецификации в `/specs` целиком. Все таблицы БД, Pydantic-схемы, коды ошибок и сигнатуры 4 MCP-инструментов зафиксированы в `tech.md` — **не выдумывай свои поля и роуты**.
2. **Не начинай разработку**, пока тимлид не смёрджил скелет (`docker-compose.yml`, миграции, `seed.py`, `LLMProvider` и эталонный эндпоинт `/api/v1/dashboard`).
3. При нехватке контракта в `tech.md` остановись и выведи блок `CONTRACT GAP`.

---

## Твоя зона ответственности
Ты отвечаешь за серверную бизнес-логику, AI/RAG пайплайн, MCP-сервер и безопасность:
- **Слайс 2 (Сервер):** Эндпоинты дорожной карты `GET /api/v1/roadmap`, `POST /api/v1/roadmap/nodes/<node_id>/verify`, MCP-тул `verify_onboarding_task`, AI-валидатор логов `avito-cli` / ответов квиза и идемпотентный движок начисления XP (`backend/app/services/gamification.py`).
- **Слайс 3 (Сервер):** Контекстный RAG по `pgvector` с ABAC-фильтрацией по роли и кластеру (`backend/app/services/rag_service.py`), алгоритм детекции коллизий между `playbook_global` и `cluster_specific`, а также генератор умной эскалации (`Buddy -> Manager -> HR BP`).
- **Слайс 4 (Сервер):** Выделенный MCP-сервер (`backend/app/mcp_server/server.py`) с 4 обязательными инструментами, проверкой идемпотентности через `service_requests.idempotency_key` и эндпоинтом `POST /api/v1/mcp/execute`.
- **Слайс 5 (Сервер):** Эндпоинты календаря `GET /api/v1/calendar`, генератора конспектов `POST /api/v1/calendar/summary` и вечернего чек-ина `POST /api/v1/pulse`.
- **Безопасность:** Строгие декораторы RBAC/ABAC (`backend/app/middleware/rbac.py`) и серверный Guardrail-фильтр секретов (`backend/app/middleware/guardrails.py`).

### Файлы, которые трогать ЗАПРЕЩЕНО
- `tech.md`, `specs/*`, `docker-compose.yml`
- `frontend/*`
- `backend/migrations/001_init.sql` (только через `CONTRACT GAP` тимлиду)

---

## Пошаговый список задач (1 задача = 1 PR)

### Задача B1 (Слайс 2 — Сервер): API Дорожной карты, Идемпотентный движок XP и MCP `verify_onboarding_task`
- **Цель:** Реализовать получение графа дорожной карты с Redis-кэшем и верификацию узлов (`guide`, `quiz`) через MCP-инструмент `verify_onboarding_task`.
- **Файлы:** `backend/app/api/roadmap.py`, `backend/app/services/gamification.py`, `backend/app/mcp_server/server.py`, `backend/app/middleware/guardrails.py`.
- **Критерии приёмки (AC):**
  1. `GET /api/v1/roadmap` возвращает список узлов с текущими статусами пользователя из `user_node_progress` быстрее `100 мс` (кэширование в Redis по ключу `roadmap:{user_id}`).
  2. Входной `content` в `POST /api/v1/roadmap/nodes/<node_id>/verify` сначала проходит через `guardrails.validate_no_secrets(content)`. При обнаружении приватного SSH-ключа или токена возвращается `422 Unprocessable Entity` (`{"error": "GUARDRAIL_SECRET_DETECTED"}`).
  3. MCP-тул `verify_onboarding_task(user_id, node_id, artifact_type, content)` проверяет:
     - для `node_w1_cli` (`artifact_type = 'cli_log'`): наличие подстрок `avito-cli` и `OK` / `authenticated` (плюс проверка через `LLMProvider`);
     - для `node_w1_obs` (`artifact_type = 'quiz_answers'`): корректность ответов по назначению `Grafana` (метрики), `Sentry` (ошибки) и `Шаталити` (PaaS/деплой).
  4. **Идемпотентность:** если узел уже находится в статусе `done`, повторный вызов `verify_onboarding_task` возвращает текущий статус и **не начисляет повторный XP**. При первом успешном закрытии начисляется `xp_reward`, пересчитывается `level = 1 + (xp // 100)`, а зависимые узлы (`depends_on_node_id`) переводятся из `locked` в `active`.
- **Обязательные тесты (`backend/tests/test_roadmap_gamification.py`):**
  - Property-based тест (`hypothesis`) на функцию начисления XP, расчёта уровня и переходов статусов графа без зацикливаний и отрицательных значений.
  - Тест идемпотентности: двойной POST на `/verify` одного узла увеличивает `user.xp` ровно один раз.
  - Тест Guardrails: отправка строки с `-----BEGIN OPENSSH PRIVATE KEY-----` возвращает `422`.

### Задача B2 (Слайс 3 — Сервер): Контекстный RAG по `pgvector`, Детектор коллизий и Умная эскалация
- **Цель:** Реализовать `POST /api/v1/chat/message` с векторным/гибридным поиском, строгой ABAC/RBAC фильтрацией, детектором противоречий в документации и фоллбэком эскалации.
- **Файлы:** `backend/app/api/chat.py`, `backend/app/services/rag_service.py`, `backend/app/middleware/rbac.py`.
- **Критерии приёмки (AC):**
  1. Проверка RBAC/ABAC перед поиском:
     - если стажёр (`role == 'intern'`) запрашивает информацию о зарплатах/грейдах/чужих отпусках или обращается к проектам чужого кластера (`Fintech`), эндпоинт возвращает `403 Forbidden` с кодом `RBAC_ROLE_DENIED` или `ABAC_CLUSTER_DENIED`.
  2. Гибридный поиск в `knowledge_chunks` отбирает релевантные чанки, где `user.role = ANY(allowed_roles)` и (`source_scope = 'playbook_global'` OR `cluster = user.cluster`).
  3. **Детектор коллизий:** если по одному `topic_key` (например, `deploy_branch_policy`) найдены одновременно чанк `playbook_global` и чанк `cluster_specific` с разными правилами, сервис формирует объект `conflict_warning` (`ConflictWarningSchema`), указывая приоритет более свежей документации кластера.
  4. **Умная эскалация:** если релевантных чанков не найдено (score ниже порога), сервис не галлюцинирует, а заполняет поле `escalation` (`EscalationSuggestionSchema`): выбирает адресата (`buddy` для технических вопросов, `manager` для процессных, `hr_bp` для кадровых) и генерирует готовый черновик сообщения для Mattermost с контекстом стажёра.
- **Обязательные тесты (`backend/tests/test_rag_and_rbac.py`):**
  - Тест `403 Forbidden` при попытке роли `intern` запросить данные кластера `Fintech` или `hr_confidential`.
  - Тест детекции коллизии на запросе «Как катить на staging в кластере Auto?» (`conflict_warning is not None`).
  - Тест генерации `escalation` при запросе отсутствующей в базе темы.

### Задача B3 (Слайс 4 & 5 — Сервер): MCP-инструменты сервисных заявок, Календарь, Саммари 1:1 и Daily Pulse
- **Цель:** Реализовать оставшиеся 3 MCP-инструмента (`create_absence_request`, `request_service_access`, `schedule_calendar_meeting`), эндпоинт подтверждения `POST /api/v1/mcp/execute`, API календаря и вечернего пульса.
- **Файлы:** `backend/app/mcp_server/server.py`, `backend/app/mcp_server/adapters.py`, `backend/app/api/calendar.py`, `backend/app/api/pulse.py`, `backend/app/services/calendar_summary.py`.
- **Критерии приёмки (AC):**
  1. Интент-роутер в `POST /api/v1/chat/message` при распознавании запроса на отгул, доступ в Jira/Stash или запись на встречу возвращает `proposed_mcp_action` (Human-in-the-loop) без немедленного выполнения действия.
  2. `POST /api/v1/mcp/execute` проверяет `idempotency_key` в таблице `service_requests`. Если ключ уже выполнялся, возвращает сохранённый результат без создания дубликата заявки или второй встречи в календаре.
  3. Вызов `request_service_access` для роли `intern` с `access_level = 'admin'` или чужим `project_key` возвращает `403 Forbidden`.
  4. `POST /api/v1/calendar/summary` агрегирует закрытые узлы `user_node_progress`, текущий XP и теги блокеров из `daily_pulses`, генерируя через `LLMProvider` (или оффлайн-мок) структурированный конспект к встрече 1:1 или структуру презентации к Экватору.
  5. `POST /api/v1/pulse` идемпотентно сохраняет чек-ин за `CURRENT_DATE`, увеличивает `streak_days` и начисляет `+15 XP`.
- **Обязательные тесты (`backend/tests/test_mcp_and_calendar.py`):**
  - Контрактные тесты на все 4 MCP-инструмента по схемам из `/specs/mcp-tools.yaml`.
  - Тест идемпотентности `POST /api/v1/mcp/execute` с одинаковым `idempotency_key`.
  - Тест `POST /api/v1/calendar/summary` и `POST /api/v1/pulse` (проверка сохранения `streak_days` и защиты от повторного начисления XP в один день).
