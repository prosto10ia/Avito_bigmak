# tech.md — Единое замороженное ядро проекта AI-buddy (Avito Start)

**Version:** v1.0
**Changelog:**
- `v1.0` — Initial Frozen Core: PostgreSQL + pgvector schema, REST & MCP contracts, shared TypeScript/Zod types, UI primitives, RBAC/ABAC matrix, and >80% coverage test strategy.

---

## 1. Суть проекта и решаемые барьеры
**AI-buddy** — Telegram Mini App (SPA с браузерным фоллбэком) для сквозной геймифицированной адаптации стажёров Авито от первого дня до Выпускного (через Экватор).
- **Стажёр (Intern):** получает интерактивную дорожную карту по периодам, прокачивает маскота за XP, задаёт вопросы AI-ассистенту по `AvitoTech Playbook` и докам кластера, отправляет заявки в корпоративные сервисы через MCP (Human-in-the-loop) и проходит вечерний чек-ин `Daily Pulse`.
- **Наставник (Buddy):** видит прогресс стажёра, получает эскалации сложных вопросов и верифицирует чувствительные этапы.
- **Руководитель (Manager) / HR BP:** видит сводную аналитику адаптации, блокеры, готовые конспекты к встречам 1:1 и черновик презентации к Экватору, а также продуктовые метрики в Grafana.

---

## 2. Технологический стек
- **Frontend:** React 18, TypeScript 5, Vite, `@telegram-apps/sdk-react` (с браузерным фоллбэком), TanStack Query v5, TanStack Router, Zustand, Zod, Tailwind CSS, Lucide Icons, `src/api/client.ts`.
- **Backend:** Python 3.12, Flask 3.0 (модульный монолит), SQLAlchemy 2.0, Pydantic v2, `mcp` (Python MCP SDK), OpenAI Python SDK (совместимый с Qwen / DeepSeek / Avito A-Vibe + детерминированный оффлайн демо-мок при пустом `LLM_API_KEY`).
- **Базы данных:** PostgreSQL 16 + `pgvector` (основная БД + векторный индекс `HNSW` для RAG), Redis 7 (кэш дорожной карты и дашборда с TTL 60s для отклика `< 100 мс`, сессии ролей, идемпотентные ключи).
- **Спецификации (SDD):** OpenSpec / spec-kit в директории `/specs` (`openapi.yaml`, `mcp-tools.yaml`, `agent-behavior.yaml`).
- **Инфраструктура и Тесты:** Docker Compose, Grafana (дашборд поверх PostgreSQL `clickstream_events`), Vitest + React Testing Library + `fast-check` (Frontend), `pytest` + `pytest-cov` + `hypothesis` (Backend). Порог покрытия прикладного кода: **> 80%**.

---

## 3. Архитектура монорепозитория и структура папок

```text
/
├── CLAUDE.md
├── tech.md
├── LEAD.md
├── DEV_A.md
├── DEV_B.md
├── docker-compose.yml
├── .env.example
├── CODEOWNERS
├── specs/
│   ├── openapi.yaml
│   ├── mcp-tools.yaml
│   └── agent-behavior.yaml
├── grafana/
│   └── provisioning/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/
│       │   └── client.ts          # Замороженный типизированный клиент + Zod-валидация
│       ├── types/
│       │   └── domain.ts          # Замороженные TS-типы и Zod-схемы
│       ├── lib/
│       │   ├── guardrails.ts      # Клиентский Regex-фильтр SSH-ключей и секретов
│       │   └── gamification.ts    # Чистые функции расчёта XP, уровней и Streak
│       ├── store/
│       │   └── useAuthStore.ts    # Текущий профиль, переключение ролей, demo-token
│       ├── components/
│       │   └── ui/                # 9 пред-собранных UI-примитивов тимлида
│       └── routes/
│           ├── index.tsx          # Таб 1: Дашборд («Домой»)
│           ├── roadmap.tsx        # Таб 2: Дорожная карта и Маскот
│           ├── chat.tsx           # Таб 3: AI-помощник (RAG + Actionable MCP)
│           ├── calendar.tsx       # Таб 4: Календарь встреч и дедлайнов
│           └── profile.tsx        # Таб 5: Профиль и Демо-панель жюри
└── backend/
    ├── pyproject.toml
    ├── Dockerfile
    ├── app/
    │   ├── __init__.py            # Фабрика Flask create_app()
    │   ├── config.py
    │   ├── db.py
    │   ├── models.py              # SQLAlchemy 2.0 модели (8 таблиц)
    │   ├── schemas.py             # Pydantic v2 схемы запросов/ответов
    │   ├── middleware/
    │   │   ├── rbac.py            # Декораторы RBAC/ABAC проверки ролей и кластеров
    │   │   └── guardrails.py      # Серверный Regex-перехватчик приватных ключей/токенов
    │   ├── services/
    │   │   ├── llm_provider.py    # Обёртка OpenAI API + детерминированный OfflineMockLLM
    │   │   ├── rag_service.py     # Гибридный поиск pgvector + детектор коллизий + эскалация
    │   │   ├── gamification.py    # Идемпотентное начисление XP и расчёт Streak
    │   │   └── calendar_summary.py# Генератор конспекта 1:1 и черновика Экватора
    │   ├── mcp_server/
    │   │   ├── server.py          # Регистрация и роутинг 4 обязательных MCP-тулов
    │   │   └── adapters.py        # Фейковые адаптеры Jira/Stash, Absence, Calendar, Validator
    │   └── api/
    │       ├── dashboard.py
    │       ├── roadmap.py
    │       ├── chat.py
    │       ├── calendar.py
    │       ├── pulse.py
    │       └── telemetry.py
    ├── migrations/
    │   └── 001_init.sql
    ├── seed.py
    └── tests/
```

---

## 4. Схема БД PostgreSQL (`migrations/001_init.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('intern', 'buddy', 'manager')),
    job_title VARCHAR(80) NOT NULL,
    team VARCHAR(80) NOT NULL,
    cluster VARCHAR(80) NOT NULL,
    mentor_id VARCHAR(64) REFERENCES users(id),
    manager_id VARCHAR(64) REFERENCES users(id),
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    streak_days INTEGER NOT NULL DEFAULT 1,
    last_pulse_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roadmap_nodes (
    id VARCHAR(64) PRIMARY KEY,
    period VARCHAR(32) NOT NULL CHECK (period IN ('week_1', 'week_2', 'month_1', 'month_2', 'month_3', 'equator')),
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    node_type VARCHAR(32) NOT NULL CHECK (node_type IN ('guide', 'service_action', 'quiz')),
    xp_reward INTEGER NOT NULL DEFAULT 50,
    order_index INTEGER NOT NULL,
    target_role VARCHAR(32) NOT NULL DEFAULT 'intern',
    verification_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    depends_on_node_id VARCHAR(64) REFERENCES roadmap_nodes(id)
);

CREATE TABLE user_node_progress (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id VARCHAR(64) NOT NULL REFERENCES roadmap_nodes(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL CHECK (status IN ('locked', 'active', 'waiting_approval', 'done')),
    verified_artifact TEXT,
    verification_feedback TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, node_id)
);

CREATE TABLE service_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_name VARCHAR(64) NOT NULL CHECK (tool_name IN ('create_absence_request', 'request_service_access', 'schedule_calendar_meeting', 'verify_onboarding_task')),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('pending_confirmation', 'approved', 'rejected', 'completed')),
    external_ticket_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calendar_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_id VARCHAR(64) REFERENCES users(id),
    title VARCHAR(160) NOT NULL,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('one_on_one', 'deadline', 'team_sync', 'equator_defense')),
    starts_at TIMESTAMPTZ NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 30,
    agenda TEXT,
    auto_summary TEXT
);

CREATE TABLE daily_pulses (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pulse_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
    blocker_tags TEXT[] NOT NULL DEFAULT '{}',
    comment TEXT,
    xp_awarded INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, pulse_date)
);

CREATE TABLE knowledge_chunks (
    id VARCHAR(64) PRIMARY KEY,
    doc_title VARCHAR(200) NOT NULL,
    source_url VARCHAR(300) NOT NULL,
    source_scope VARCHAR(32) NOT NULL CHECK (source_scope IN ('playbook_global', 'cluster_specific', 'hr_confidential')),
    cluster VARCHAR(80),
    allowed_roles TEXT[] NOT NULL DEFAULT '{intern,buddy,manager}',
    topic_key VARCHAR(80) NOT NULL,
    version_date DATE NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384)
);

CREATE TABLE clickstream_events (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL,
    event_name VARCHAR(80) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_progress_user ON user_node_progress(user_id);
CREATE INDEX idx_calendar_user_date ON calendar_events(user_id, starts_at);
CREATE INDEX idx_knowledge_scope_cluster ON knowledge_chunks(source_scope, cluster, topic_key);
CREATE INDEX idx_clickstream_name_time ON clickstream_events(event_name, created_at);
```

---

## 5. Контракты REST API и MCP-инструментов (SDD)

### 5.1 Заголовки авторизации и демо-доступа
Каждый запрос из `frontend/src/api/client.ts` передаёт:
- `X-Demo-Access-Code: hack-and-change-2026`
- `X-User-Id: usr_intern_1` (или `usr_buddy_1`, `usr_manager_1` при переключении роли)
- `X-User-Role: intern | buddy | manager`

### 5.2 Матрица RBAC / ABAC и Guardrails
- **ABAC правило кластера:** стажёр из кластера `Auto` не имеет доступа к документам и проектам кластера `Fintech` или `RealEstate` (`source_scope = 'cluster_specific'` и `cluster != user.cluster`) -> возвращается `403 Forbidden` с кодом `ABAC_CLUSTER_DENIED`.
- **RBAC правило конфиденциальности:** запрос стажёром чанков с `source_scope = 'hr_confidential'` (грейды, зарплатные вилки других сотрудников, чужие отпуска) -> `403 Forbidden` (`RBAC_ROLE_DENIED`).
- **Guardrails фильтр секретов:** если входной текст чата или лог верификации содержит паттерны `-----BEGIN [A-Z ]*PRIVATE KEY-----`, `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}` или `avito_secret_[a-zA-Z0-9]+`, запрос блокируется на клиенте и сервере с кодом `422 Unprocessable Entity` (`GUARDRAIL_SECRET_DETECTED`) без отправки во внешнюю LLM.

### 5.3 Спецификации 4 обязательных MCP-инструментов (`/specs/mcp-tools.yaml`)
1. `create_absence_request(user_id: str, type: 'day_off' | 'vacation' | 'sick_leave', date_from: str, date_to: str, reason: str) -> MCPToolResult`
   - Идемпотентность по `sha256(user_id + type + date_from + date_to)`. Создаёт запись в `service_requests` и возвращает `external_ticket_id` (`ABS-2026-xxx`).
2. `request_service_access(user_id: str, service_name: 'jira' | 'confluence' | 'stash' | 'k8s_namespace', project_key: str, access_level: 'read' | 'write' | 'admin') -> MCPToolResult`
   - Проверяет ABAC: если `project_key` принадлежит чужому кластеру или `access_level == 'admin'` для `intern`, возвращает `403 Forbidden`. Иначе создаёт заявку `ACC-2026-xxx` и переводит связанный Service Action-узел в `done`.
3. `schedule_calendar_meeting(user_id: str, participant_id: str, title: str, datetime: str, duration_min: int, agenda: str) -> MCPToolResult`
   - Создаёт событие в `calendar_events` и возвращает карточку встречи.
4. `verify_onboarding_task(user_id: str, node_id: str, artifact_type: 'cli_log' | 'screenshot' | 'quiz_answers', content: str) -> MCPToolResult`
   - Проверяет артефакт через Guardrails, затем валидирует выполнение (наличие `avito-cli: OK`, `stash_ssh: authenticated` или правильных ответов по `Grafana`/`Sentry`). При успехе идемпотентно переводит узел в `done`, разблокирует зависимые узлы и начисляет XP один раз.

### 5.4 Эндпоинты REST API
- `GET /api/v1/dashboard` -> `DashboardResponse` (профиль, маскот, топ-3 активных узла, ближайшие 2 встречи, статус `Daily Pulse` за сегодня).
- `POST /api/v1/auth/switch-role` (`{ target_role: 'intern' | 'buddy' | 'manager' }`) -> `UserProfile`.
- `GET /api/v1/roadmap` -> `RoadmapResponse` (список всех узлов по 6 периодам со статусами и прогрессом маскота).
- `POST /api/v1/roadmap/nodes/<node_id>/verify` (`VerifyNodeRequest`) -> вызывает MCP `verify_onboarding_task`, возвращает `VerifyNodeResponse`.
- `POST /api/v1/chat/message` (`ChatMessageRequest`) -> возвращает `ChatMessageResponse` (ответ RAG, список `sources`, флаг и детали `conflict_warning`, блок `escalation` при отсутствии ответа, либо `proposed_mcp_action` для Human-in-the-loop).
- `POST /api/v1/mcp/execute` (`ExecuteMCPRequest`) -> подтверждение карточки Human-in-the-loop пользователем, вызывает выбранный MCP-тул и возвращает `MCPToolResult`.
- `GET /api/v1/calendar?month=2026-11` -> `CalendarResponse` (события + агрегация по дням).
- `POST /api/v1/calendar/summary` (`{ summary_type: 'one_on_one' | 'equator' }`) -> `CalendarSummaryResponse` (сгенерированный конспект закрытых узлов, XP и блокеров).
- `POST /api/v1/pulse` (`DailyPulseRequest`) -> сохраняет вечерний чек-ин, обновляет `streak_days`, начисляет `+15 XP` (идемпотентно 1 раз в сутки).
- `POST /api/v1/telemetry` (`TelemetryEventRequest`) -> пишет событие в `clickstream_events` (`201 Created`).

---

## 6. Общие TypeScript-типы и Zod-схемы (`frontend/src/types/domain.ts`)

```typescript
import { z } from 'zod';

export const RoleSchema = z.enum(['intern', 'buddy', 'manager']);
export type Role = z.infer<typeof RoleSchema>;

export const PeriodSchema = z.enum(['week_1', 'week_2', 'month_1', 'month_2', 'month_3', 'equator']);
export type Period = z.infer<typeof PeriodSchema>;

export const NodeTypeSchema = z.enum(['guide', 'service_action', 'quiz']);
export const NodeStatusSchema = z.enum(['locked', 'active', 'waiting_approval', 'done']);

export const UserProfileSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  role: RoleSchema,
  job_title: z.string(),
  team: z.string(),
  cluster: z.string(),
  mentor_name: z.string(),
  manager_name: z.string(),
  xp: z.number(),
  level: z.number(),
  mascot_stage: z.enum(['egg', 'chick', 'wingman', 'legend']),
  streak_days: z.number(),
  pulse_completed_today: z.boolean(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const RoadmapNodeSchema = z.object({
  id: z.string(),
  period: PeriodSchema,
  title: z.string(),
  description: z.string(),
  node_type: NodeTypeSchema,
  xp_reward: z.number(),
  order_index: z.number(),
  status: NodeStatusSchema,
  verification_config: z.record(z.any()),
  verified_artifact: z.string().nullable().optional(),
  verification_feedback: z.string().nullable().optional(),
});
export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;

export const SourceCitationSchema = z.object({
  id: z.string(),
  doc_title: z.string(),
  source_url: z.string(),
  source_scope: z.enum(['playbook_global', 'cluster_specific']),
  version_date: z.string(),
});
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const ConflictWarningSchema = z.object({
  topic_key: z.string(),
  summary: z.string(),
  playbook_claim: z.string(),
  cluster_claim: z.string(),
  recommended_source_url: z.string(),
});
export type ConflictWarning = z.infer<typeof ConflictWarningSchema>;

export const EscalationSuggestionSchema = z.object({
  target_role: z.enum(['buddy', 'manager', 'hr_bp']),
  target_name: z.string(),
  mattermost_handle: z.string(),
  draft_message: z.string(),
});
export type EscalationSuggestion = z.infer<typeof EscalationSuggestionSchema>;

export const ProposedMCPActionSchema = z.object({
  tool_name: z.enum([
    'create_absence_request',
    'request_service_access',
    'schedule_calendar_meeting',
    'verify_onboarding_task',
  ]),
  title: z.string(),
  summary: z.string(),
  payload: z.record(z.any()),
  idempotency_key: z.string(),
});
export type ProposedMCPAction = z.infer<typeof ProposedMCPActionSchema>;

export const ChatMessageResponseSchema = z.object({
  reply: z.string(),
  sources: z.array(SourceCitationSchema),
  conflict_warning: ConflictWarningSchema.nullable(),
  escalation: EscalationSuggestionSchema.nullable(),
  proposed_mcp_action: ProposedMCPActionSchema.nullable(),
});
export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>;
```

---

## 7. Список UI-примитивов (`frontend/src/components/ui/`)
Собираются тимлидом в скелете. Разработчики переиспользуют их без изменения сигнатур пропсов:
1. `AppShell({ children }): JSX.Element`
2. `BottomNav({ activeTab }): JSX.Element`
3. `MascotProgressHeader({ xp, level, mascotStage, streakDays }): JSX.Element`
4. `RoadmapNodeCard({ node, onSelect }): JSX.Element`
5. `ActionRequestWidget({ action, onConfirm, onCancel, isLoading, resultTicket }): JSX.Element`
6. `SourceLinkChip({ source }): JSX.Element`
7. `ConflictWarningBanner({ conflict }): JSX.Element`
8. `DailyPulseModal({ isOpen, onClose, onSubmit }): JSX.Element`
9. `RoleSwitcherBadge({ currentRole, onSwitchRole }): JSX.Element`

---

## 8. Стратегия тестирования (Порог кейса > 80%)
- **Backend (`pytest`):**
  - Команда: `cd backend && pytest --cov=app --cov-report=term-missing --cov-report=xml:coverage.xml --cov-fail-under=80`
  - Обязательные категории: Contract validation (Pydantic), Idempotency (повторный вызов MCP и повторный `verify`), Security (`403 Forbidden` на ABAC/RBAC и `422` на SSH-ключ), Property-based (`hypothesis` на расчёте XP/уровня и переходе статусов узлов).
- **Frontend (`vitest`):**
  - Команда: `cd frontend && npm run test:coverage` (`vitest run --coverage` с порогом `lines: 80, functions: 80, statements: 80` в `vite.config.ts`).

---

## 9. Конвенция коммитов, PR и правила кода
- Язык коммитов, PR и комментариев в коде — **английский**. Язык интерфейса и тестовых данных для жюри — **русский**.
- Формат коммитов: `type(scope): summary` (`feat|fix|test|refactor|chore|docs`, строчные буквы, без точки, до 50 символов). Примеры:
  - `feat(roadmap): add cli log verification modal`
  - `feat(mcp): implement request_service_access tool`
  - `test(rbac): verify 403 on cross-cluster query`
- Никакого закомментированного кода в PR.
- При нехватке контракта в `tech.md` разработчик обязан остановить генерацию кода и выдать блок `CONTRACT GAP`.

---

## 10. Definition of Done (DoD) одной задачи
1. Линтер и тайпчек проходят без ошибок (`npm run lint && npm run typecheck`, `ruff check backend/`).
2. Написаны автотесты слайса (happy path + идемпотентность + `403`/`422` ошибка), общее покрытие остаётся `> 80%`.
3. Сценарий работает как с реальным `LLM_API_KEY`, так и в оффлайн демо-режиме (при пустом ключе).
4. Проверена сборка в `docker compose up --build`.
