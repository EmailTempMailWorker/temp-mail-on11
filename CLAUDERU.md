---

## Файл: [`CLAUDERU.md`](https://github.com/EmailTempMailWorker/temp-mail-on11/blob/main/CLAUDERU.md) — **на русском, по той же структуре**

```markdown
# Temp Mail Worker - Инструкции по коду (Claude)

Этот репозиторий — **сервис временной почты на Cloudflare Workers**, предоставляющий одноразовые email-адреса с поддержкой вложений. Письма принимаются через Cloudflare Email Routing, сохраняются в D1, доступны через REST API.

**Теперь с интеграцией Telegram-бота** — пользователи могут запрашивать личные ящики и получать письма **прямо в чат**.

## Обзор проекта

- **Тип**: Cloudflare Worker + Hono Framework
- **Назначение**: Временная почта + **личные ящики в Telegram**
- **API**: https://api.on11.ru
- **Среда**: Cloudflare Workers (Edge Computing)
- **Менеджер пакетов**: Bun

## Технологический стек

### Основные технологии
- **Runtime**: Cloudflare Workers (Edge Computing)
- **Фреймворк**: Hono.js
- **Язык**: TypeScript (ESNext)
- **Пакеты**: Bun

### Ключевые зависимости
- **@hono/zod-openapi**: Генерация OpenAPI
- **@hono/zod-validator**: Валидация через Zod
- **zod**: Валидация схем
- **postal-mime**: Парсинг писем
- **html-to-text**: Конвертация HTML
- **@paralleldrive/cuid2**: Генерация ID

### Инструменты разработки
- **Biome**: Форматирование и линтинг (табы, 100 символов)
- **TypeScript**: Строгий режим
- **Wrangler**: CLI Cloudflare
- **Knip**: Поиск неиспользуемых зависимостей

### Сервисы Cloudflare
- **D1**: База для писем + **сессий пользователей**
- **R2**: Хранилище вложений (до 50 МБ) *(опционально)*
- **Email Routing**: Приём писем
- **Scheduled**: Автоочистка

## Структура директорий

src/
├── app.ts                     # Настройка Hono
├── index.ts                   # Точка входа (email, cron, Telegram webhook)
├── config/                    # Конфиги
│   ├── constants.ts
│   └── domains.ts
├── database/                  # Работа с БД
│   ├── d1.ts                  # D1 + user_sessions
│   └── r2.ts                  # R2 (опционально)
├── handlers/                  # Обработчики
│   ├── emailHandler.ts        # Обработка писем + Telegram
│   └── scheduledHandler.ts
├── middlewares/               # Промежуточные слои
│   ├── cors.ts
│   └── validateDomain.ts
├── routes/                    # API маршруты
│   ├── emailRoutes.ts
│   ├── attachmentRoutes.ts
│   └── healthRoutes.ts
├── schemas/                   # Zod схемы
│   ├── emails/
│   └── attachments/
├── telegram/                  # НОВОЕ: Telegram
│   ├── bot.ts                 # Команды: /get_mailbox
│   └── sender.ts              # Отправка в чат
├── mailbox/                   # НОВОЕ: Ящики
│   └── manager.ts             # Управление сессиями
└── utils/                     # Утилиты
├── docs.ts
├── helpers.ts
├── http.ts
├── logger.ts
├── mail.ts
├── performance.ts
└── telegram.ts
sql/                           # Схемы БД
├── schema.sql
├── indexes.sql
└── migrations/                # НОВОЕ: миграция user_sessions
cloudflare-info/
└── index.ts


## Скрипты

### Разработка и деплой
- `bun run dev` - Локальный сервер
- `bun run deploy` - Деплой
- `bun run tail` - Логи

### База данных
- `bun run db:create` - Создать D1
- `bun run db:tables` - Применить схему
- `bun run db:indexes` - Индексы
- `bun run db:migrate-sessions` - **Миграция user_sessions**

### Хранилище *(опционально)*
- `bun run r2:create`
- `bun run r2:create-preview`

### Качество кода
- `bun run check`, `lint`, `format`, `tsc`, `knip`

### Утилиты
- `bun run cf-info`, `cf-typegen`

## Ключевые возможности

### Почта
- **Множество доменов**: `on11.ru` и др.
- **Хранение**: D1
- **HTML → текст**
- **Автоочистка**: 3 часа

### Вложения
- 50 МБ, 10 файлов
- Поддержка: изображения, документы, архивы
- **R2 или прямая пересылка в Telegram**

### **НОВОЕ: Личные ящики в Telegram**
- `/get_mailbox` → `xyz123@on11.ru` (1 час)
- Письма **мгновенно в чат**
- Админ получает дубликат
- Автоудаление

### API
- Полный REST + OpenAPI
- Письма, вложения, домены

### Мониторинг
- **Telegram**: админ + пользователи
- Производительность, логи, ошибки

## Архитектура

- Модульность
- DI через env
- Zod валидация
- Edge-first

## Настройка

```bash
bun install
bun wrangler login
bun run db:create
bun run db:tables
bun run db:indexes
bun run db:migrate-sessions
bun run dev
bun run deploy

## Заметки о конфигурации

### Переменные среды
- `TELEGRAM_LOG_ENABLE`: Включить/отключить ведение журнала Telegram
- `HOURS_TO_DELETE_D1`: Срок хранения писем (по умолчанию: 3 часа)
- `TELEGRAM_BOT_TOKEN`: Токен бота Telegram (секретный)
- `TELEGRAM_CHAT_ID`: Идентификатор чата Telegram для ведения журнала (секретный)

### Привязки Cloudflare
- **D1**: Привязка к базе данных для хранения электронной почты
- **R2**: Хранилище объектов для вложений
- **Scheduled**: Триггеры заданий Cron для очистки

### Советы по разработке
- Используйте `.dev.vars` для локальных секретов разработки
- Обновите `wrangler.jsonc`, указав идентификаторы ресурсов Cloudflare
- Используйте Biome для единообразного форматирования кода
- Используйте обширный набор типов TypeScript и Схемы

## Рекомендации по стилю кода

### Форматирование (Biome)
- **Отступы**: Табуляция, ширина 2 пробела
- **Ширина строки**: максимум 100 символов
- **Кавычки**: Двойные кавычки для строк
- **Точка с запятой**: Всегда используется
- **Квадратные скобки**: В стиле K&R (скобки на одной строке)

### TypeScript
- **Строгий режим**: Включен
- **Разрешение модулей**: В стиле Bundler
- **Псевдонимы путей**: `@/*` соответствует `./src/*`
- **JSX**: Использует Hono JSX с преобразованием React-jsx

### Рекомендации
- Используйте схемы Zod для проверки всех входных данных
- Используйте возможности периферийных вычислений Cloudflare Workers
- Реализуйте правильную обработку ошибок и ведение журнала
- Следуйте установленным модульным Архитектура
- Используйте интерфейсы TypeScript для обеспечения типобезопасности

Этот проект следует современным шаблонам разработки Cloudflare Workers с упором на производительность, надежность и удобство поддержки.