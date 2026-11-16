# LEAD.md — Инструкция Тимлида / Архитектора (AI-buddy)

## 1. Твоя зона ответственности
Ты отвечаешь за единое ядро `tech.md`, SDD-спецификации в `/specs`, инфраструктуру `docker-compose.yml`, CI/CD с проверкой покрытия `> 80%`, сид-данные реального чек-листа Авито, оффлайн демо-режим LLM, пред-сборку 9 UI-примитивов и **Слайс 1 (Эталонный вертикальный слайс: Авторизация, Переключатель ролей, RBAC/Guardrails мидлвари, Главный Дашборд и Clickstream + Grafana)**.

Разработчики `DEV_A` и `DEV_B` не начинают работу над своими слайсами, пока твой скелет не смёрджен в `main` и чек-лист «Скелет готов» не выполнен на 100%.

---

## 2. Настройка CODEOWNERS и защита контрактов
Создай `.github/CODEOWNERS`:
```text
/tech.md @team-lead
/specs/ @team-lead
/docker-compose.yml @team-lead
/frontend/src/types/domain.ts @team-lead
/frontend/src/api/client.ts @team-lead
/frontend/src/components/ui/ @team-lead
/backend/migrations/ @team-lead
/backend/seed.py @team-lead
```

---

## 3. Пошаговый план сборки скелета (Stage 0 & Слайс 1)

### Шаг 1. Наполнение `/specs` (SDD — OpenSpec / spec-kit)
1. Создай `specs/mcp-tools.yaml` с формальным JSON Schema описанием 4 обязательных инструментов:
   - `create_absence_request`
   - `request_service_access`
   - `schedule_calendar_meeting`
   - `verify_onboarding_task`
2. Создай `specs/openapi.yaml` со всеми REST-эндпоинтами из раздела 5.4 `tech.md`.
3. Создай `specs/agent-behavior.yaml` с правилами системного промпта AI-buddy, детекции коллизий (`playbook_global` vs `cluster_specific`), матрицей эскалации (`buddy -> manager -> hr_bp`) и списком запрещённых паттернов Guardrails.

### Шаг 2. Docker Compose и конфигурация (`.env.example`)
Собери `docker-compose.yml` с 5 сервисами:
- `postgres`: образ `pgvector/pgvector:pg16`, порт `5432`, healthcheck `pg_isready`.
- `redis`: образ `redis:7-alpine`, порт `6379`.
- `backend`: сборка из `./backend`, порт `8000`, запускает миграцию `001_init.sql`, `python seed.py` и `gunicorn` / `flask run`.
- `frontend`: сборка из `./frontend`, порт `3000`, проксирует `/api` на `backend:8000`.
- `grafana`: образ `grafana/grafana:latest`, порт `3001`, авто-провижининг источника PostgreSQL и дашборда продуктовых метрик.

Создай `.env.example` без секретов:
```env
DEMO_ACCESS_CODE=hack-and-change-2026
DATABASE_URL=postgresql://avito:avito@postgres:5432/aibuddy
REDIS_URL=redis://redis:6379/0
LLM_API_BASE=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
```

### Шаг 3. Сид-скрипт (`backend/seed.py`) с данными чек-листа Авито
Напиши идемпотентный `seed.py` (с пометкой в коде и UI: `Тестовые данные для демонстрации прототипа на хакатоне Hack&Change 2026`):
1. **3 демо-профиля (`users`):**
   - `usr_intern_1`: Алексей Смирнов (`intern`, Backend Engineer, кластер `Auto`, ментор `usr_buddy_1`, руководитель `usr_manager_1`, `xp: 120`, `level: 2`, `streak_days: 3`).
   - `usr_buddy_1`: Мария Козлова (`buddy`, Senior Go Developer, кластер `Auto`).
   - `usr_manager_1`: Дмитрий Волков (`manager`, Engineering Manager, кластер `Auto`).
2. **Узлы дорожной карты (`roadmap_nodes`) по реальному чек-листу Авито:**
   - `week_1`:
     - `node_w1_cli` (`guide`, 50 XP): «Настрой avito-cli и SSH-ключи в Stash» (проверка лога `avito-cli status --check`).
     - `node_w1_access` (`service_action`, 50 XP): «Запроси доступ в пространство кластера Auto в Jira и Stash» (вызов MCP `request_service_access`).
     - `node_w1_obs` (`quiz`, 75 XP): «Инструменты наблюдаемости: Grafana, Sentry, Observer, Redash и Шаталити» (мини-практикум из 3 вопросов).
   - `week_2`, `month_1`, `month_2`, `month_3`, `equator`: минимум по 2 узла на каждый период (первый PR в мастер, знакомство с PaaS, кросс-ревью, сборка черновика презентации к Экватору).
3. **База знаний (`knowledge_chunks`) с предвычисленными детерминированными эмбеддингами:**
   - Чанки из `AvitoTech Playbook` (`source_scope = 'playbook_global'`): настройка `avito-cli`, флоу отгулов и отпусков, правила оформления PR, гайд по `Grafana`/`Sentry`/`Шаталити`.
   - **Намеренная коллизия для демонстрации жюри (`topic_key = 'deploy_branch_policy'`):**
     - Чанк 1 (`playbook_global`, `version_date = '2025-05-10'`): «По общему стандарту AvitoTech деплой на staging выполняется из ветки `develop` через ручной триггер в TeamCity».
     - Чанк 2 (`cluster_specific`, `cluster = 'Auto'`, `version_date = '2026-09-15'`): «В кластере Auto деплой на staging выполняется автоматически при пуше в ветку `master` через `avito-cli paas release`».
   - Закрытый чанк чужого кластера (`source_scope = 'cluster_specific'`, `cluster = 'Fintech'`) и конфиденциальный HR-чанк (`source_scope = 'hr_confidential'`, `allowed_roles = '{manager}'`) для демонстрации `403 Forbidden`.
4. **События календаря (`calendar_events`):**
   - Встреча 1:1 с наставником Марией Козловой, командный дейли, дедлайн первой недели и дата защиты Экватора.

### Шаг 4. Оффлайн демо-мок LLM (`backend/app/services/llm_provider.py`)
Реализуй класс `LLMProvider`. Если `LLM_API_KEY` пуст, используй `OfflineMockLLM`:
- Детерминированно формирует ответы по найденным чанкам RAG, распознаёт интенты на отгул/доступ/встречу для карточек MCP, проверяет лог `avito-cli status --check` и генерирует конспект к встрече 1:1. Это гарантирует 100% работоспособность при проверке жюри без внешних ключей.

### Шаг 5. Эталонный Слайс 1 (Главный дашборд + Переключатель ролей + Clickstream)
1. Бэкенд: реализуй `GET /api/v1/dashboard` (кэширование в Redis на 60 сек, инвалидация при смене статуса узла/пульса), `POST /api/v1/auth/switch-role` и `POST /api/v1/telemetry`.
2. Фронтенд: собери `src/api/client.ts`, все 9 UI-примитивов в `src/components/ui/` и экран `src/routes/index.tsx` (Приветствие, таймлайн «1 неделя, день 3», `MascotProgressHeader`, топ-3 текущие задачи, ближайшие встречи и кнопка вызова `DailyPulseModal`).
3. Настрой Grafana-дашборд `grafana/provisioning/dashboards/aibuddy.json` с 4 панелями поверх `clickstream_events`:
   - *Onboarding Completion Rate*
   - *Support Deflection Rate (RAG vs Escalation)*
   - *MCP Actions Executed*
   - *Daily Pulse Mood & Blocker Distribution*

---

## 4. Чек-лист ревью PR от `DEV_A` и `DEV_B`
Перед мёрджем любого PR проверь:
1. Не изменены файлы из `CODEOWNERS` без согласованного бампа версии `tech.md`.
2. Все входные и выходные данные валидируются через `Zod` на клиенте и `Pydantic` на сервере.
3. В PR присутствуют тесты на happy path, идемпотентность и негативный сценарий (`403`/`422`), а общий отчёт покрытия в CI показывает **> 80%**.
4. Сценарий работает при пустом `LLM_API_KEY`.
