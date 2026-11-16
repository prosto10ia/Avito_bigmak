# DEV_A.md — Инструкция Разработчика A (Frontend TMA, Дорожная карта, Маскот, Календарь, Daily Pulse)

## ПРОЧИТАЙ ПЕРВЫМ
1. Прочитай `tech.md` целиком. Все имена таблиц, эндпоинтов, Zod-схем (`frontend/src/types/domain.ts`) и сигнатуры MCP-инструментов в `tech.md` — **закон**.
2. **Не начинай разработку**, пока тимлид не смёрджил скелет и не прошёл чек-лист «Скелет готов» (`docker compose up --build` зелёный, `http://localhost:3000` открывает `AppShell` и эталонный Дашборд).
3. Твой шаблон архитектуры — эталонный слайс Дашборда (`frontend/src/routes/index.tsx`). Повторяй его паттерны работы с `TanStack Query`, `Zustand`, `src/api/client.ts` и телеметрией `POST /api/v1/telemetry`.
4. **Запрет на выдумывание контрактов:** если тебе не хватает поля в API или типа в `domain.ts`, немедленно остановись и выведи блок:
   `CONTRACT GAP: [описание недостающего поля/эндпоинта и предлагаемая схема]`

---

## Твоя зона ответственности
Ты отвечаешь за клиентский опыт Telegram Mini App (с поддержкой обычного браузера), геймификацию маскота и полную реализацию пользовательских сценариев на экранах:
- **Таб 2 (`/roadmap`):** Зигзагообразная Дорожная карта по 6 периодам, модалки прохождения узлов (`Guide` с отправкой лога `avito-cli`/скриншота, `Service Action` с виджетом подтверждения MCP, `Quiz` с интерактивным мини-практикумом).
- **Таб 3 (`/chat` — клиентская часть):** Интерфейс чата с чипсами быстрых запросов, клиентским `Guardrails`-фильтром SSH-ключей, рендером чипсов источников `SourceLinkChip`, жёлтого баннера коллизий `ConflictWarningBanner`, карточки эскалации в Mattermost и виджета `ActionRequestWidget` (Human-in-the-loop).
- **Таб 4 (`/calendar`) и `Daily Pulse`:** Сетка месяца со счётчиками событий, фильтрация встреч/дедлайнов, кнопка генерации AI-конспекта к 1:1 и черновика к Экватору, создание встречи через MCP и вечерний чек-ин `DailyPulseModal` со счётчиком `Streak`.
- **Таб 5 (`/profile`):** Профиль стажёра, матрица доступов RBAC/ABAC и демо-панель для жюри (`hack-and-change-2026`).

### Файлы, которые трогать ЗАПРЕЩЕНО
- `tech.md`, `specs/*`, `docker-compose.yml`
- `backend/migrations/*`, `backend/seed.py`
- `frontend/src/types/domain.ts` (только через запрос `CONTRACT GAP` тимлиду)

---

## Пошаговый список задач (1 задача = 1 PR)

### Задача A1 (Слайс 2 — Клиент): Дорожная карта, Маскот и верификация узлов (`/roadmap`)
- **Цель:** Реализовать интерактивный граф онбординга по периодам (`week_1` .. `equator`), расчёт прогресса маскота и модальные окна верификации для 3 типов узлов.
- **Файлы:** `frontend/src/routes/roadmap.tsx`, `frontend/src/lib/gamification.ts`, `frontend/src/lib/guardrails.ts`, `frontend/src/components/roadmap/NodeVerificationModal.tsx`.
- **Контракты и примитивы:** `GET /api/v1/roadmap`, `POST /api/v1/roadmap/nodes/:id/verify`, `POST /api/v1/mcp/execute`, примитивы `MascotProgressHeader`, `RoadmapNodeCard`, `ActionRequestWidget`.
- **Критерии приёмки (AC):**
  1. Узлы группируются по 6 периодам и отображаются зигзагом со связями зависимостей (`locked -> active -> waiting_approval -> done`).
  2. Клик по `Guide`-узлу («Настрой avito-cli и ключи в Stash») открывает пошаговый гайд и поле вставки лога терминала `avito-cli status --check` (или загрузки скриншота) с кнопкой «Предзаполнить демо-лог» для быстрой проверки жюри.
  3. Перед отправкой лога вызывается `inspectForSecrets(content)` из `src/lib/guardrails.ts`. Если обнаружен `-----BEGIN OPENSSH PRIVATE KEY-----`, отправка блокируется локально с красным алертом безопасности.
  4. Клик по `Service Action`-узлу рендерит `ActionRequestWidget` с предзаполненными параметрами `request_service_access`. После нажатия «Подтвердить» вызывается `POST /api/v1/mcp/execute`, отображается номер тикета `ACC-2026-xxx`, узел переходит в `done`, а XP маскота анимированно растёт.
  5. Клик по `Quiz`-узлу («Grafana / Sentry / Observer / Redash / Шаталити») запускает мини-практикум из 3 вопросов и отправляет ответы в `POST /api/v1/roadmap/nodes/:id/verify`.
- **Обязательные тесты (`frontend/src/__tests__/roadmap.test.tsx`):**
  - Property-based тест (`fast-check`) на чистые функции `calculateMascotStage(xp)` и `canUnlockNode(node, progressMap)` в `src/lib/gamification.ts`.
  - Unit-тест клиентского Guardrail-фильтра на перехват приватного SSH-ключа и пропускание валидного вывода `avito-cli status --check`.
  - Интеграционный тест рендера `/roadmap` и перевода узла в `done` без дублирования XP при двойном клике.

### Задача A2 (Слайс 3 & 4 — Клиент): Action-чат с RAG, Детектором коллизий и MCP-виджетами (`/chat`)
- **Цель:** Реализовать экран мультимодального AI-ассистента с поддержкой двух режимов (Контекстный RAG и Actionable AI через MCP).
- **Файлы:** `frontend/src/routes/chat.tsx`, `frontend/src/components/chat/EscalationCard.tsx`.
- **Контракты и примитивы:** `POST /api/v1/chat/message`, `POST /api/v1/mcp/execute`, примитивы `SourceLinkChip`, `ConflictWarningBanner`, `ActionRequestWidget`.
- **Критерии приёмки (AC):**
  1. Над полем ввода отображаются быстрые чипсы для жюри: «Заявка на отгул», «Запросить доступ в Jira», «Как катить на staging в кластере Auto?» (триггер коллизии), «Какие зарплатные вилки у сеньоров?» (триггер RBAC `403`), «Как настроить кастомный шардинг в закрытом контуре?» (триггер эскалации).
  2. Под каждым ответом RAG рендерятся кликабельные `SourceLinkChip` с названием документа и датой версии.
  3. Если в ответе пришёл `conflict_warning !== null`, над текстом ответа рендерится жёлтый `ConflictWarningBanner`, сравнивающий утверждение из общего `AvitoTech Playbook` и более свежей доки кластера `Auto`.
  4. Если пришёл `escalation !== null`, рендерится `EscalationCard` с цепочкой `Наставник -> Руководитель -> HR BP`, кнопкой копирования готового черновика сообщения и диплинком в Mattermost.
  5. Если пришёл `proposed_mcp_action !== null`, прямо в потоке чата рендерится `ActionRequestWidget`. По клику на «Подтвердить» выполняется `POST /api/v1/mcp/execute` и карточка меняется на подтверждённый тикет.
  6. При ответе сервера `403 Forbidden` в чате отображается понятная плашка RBAC/ABAC ограничения доступа роли `intern`.
- **Обязательные тесты (`frontend/src/__tests__/chat.test.tsx`):**
  - Рендер `ConflictWarningBanner` при наличии коллизии в ответе API.
  - Рендер и подтверждение `ActionRequestWidget` с проверкой блокировки кнопки от повторного клика.
  - Корректное отображение ошибки `403 Forbidden` и `422 Guardrail Secret Detected`.

### Задача A3 (Слайс 5 — Клиент): Календарь встреч, AI-конспект к 1:1 и Вечерний чек-ин (`/calendar`, `/profile`)
- **Цель:** Реализовать календарь адаптации с генерацией конспектов к 1:1 / Экватору, работу модалки `DailyPulseModal` и демо-панель жюри на вкладке Профиля.
- **Файлы:** `frontend/src/routes/calendar.tsx`, `frontend/src/routes/profile.tsx`.
- **Контракты и примитивы:** `GET /api/v1/calendar`, `POST /api/v1/calendar/summary`, `POST /api/v1/pulse`, `POST /api/v1/auth/switch-role`, примитивы `DailyPulseModal`, `RoleSwitcherBadge`.
- **Критерии приёмки (AC):**
  1. Сетка месяца показывает бейджи количества событий в ячейках дней и список встреч с цветовой кодировкой (`one_on_one`, `deadline`, `team_sync`, `equator_defense`).
  2. Кнопка «Собрать конспект к 1:1» и «Черновик к Экватору» вызывает `POST /api/v1/calendar/summary` и открывает готовый структурированный Markdown-отчёт по закрытым узлам, полученному XP и текущим блокерам стажёра.
  3. В `DailyPulseModal` выбор оценки 1–2 подсвечивает теги блокеров («Долго жду ревью», «Нет доступа к сервису», «Сложная документация») и предлагает в 1 клик запланировать 1:1 с наставником через MCP `schedule_calendar_meeting`.
  4. На вкладке `/profile` отображается карточка сотрудника (`role`, `team`, `cluster`, `mentor`, `manager`), статус демо-доступа `hack-and-change-2026` и переключатель `Intern / Buddy / Manager` в 1 клик.
- **Обязательные тесты (`frontend/src/__tests__/calendar_pulse.test.tsx`):**
  - Отправка `DailyPulseModal` с начислением `+15 XP` и блокировкой повторного прохождения в тот же день.
  - Генерация и отображение саммари к 1:1 и переключение ролей в `useAuthStore`.
