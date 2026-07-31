# FT1 - Retrospective

Ретроспектива скрам-команды **FT1**: ночной лагерь, костёр и покерный стол на сукне.

- Карты: плюсы / минусы / спасибо / улучшить
- История спринтов: закрыл спринт — карты ушли в архив, открылся следующий
- Сохранение: **Cloudflare D1** (Pages) или `localStorage` локально
- Если карт мало — **«Раздать»** темы из колоды у костра

## Локально

```bash
npm install
npm run dev
```

http://localhost:5173 — данные в браузере.

## История спринтов

1. В текущем спринте добавляете карты как обычно.
2. **Закрыть спринт** — архивирует текущий и создаёт пустой следующий (`номер + 1`).
3. В блоке **История** открываете прошлый спринт (только просмотр) или возвращаетесь к текущему.

Схема: таблица `sprints` + `cards.sprint_id` + `deals.sprint_id` (см. `schema.sql`).

## Cloudflare Pages + GitHub (autodeploy)

1. Создайте D1 и пропишите `database_id` в `wrangler.toml`:

```bash
npx wrangler login
npx wrangler d1 create ft1-retro
# вставьте database_id в wrangler.toml
npm run db:remote
```

2. В [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → выберите этот репозиторий.

Настройки сборки:

| Setting | Value |
|--------|--------|
| Framework preset | Vite (или None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

3. **Settings → Bindings → D1 database**: binding name `DB` → database `ft1-retro`.

4. После первого деплоя при необходимости снова накатите схему: `npm run db:remote`.

Папка `functions/` становится Pages Functions (`/api/state`, `/api/cards`, `/api/deal`, `/api/sprint`).

## Скрипты

| Команда | Что делает |
|--------|------------|
| `npm run dev` | Vite + localStorage |
| `npm run build` | Typecheck + `dist` |
| `npm run db:remote` | Схема в D1 |
| `npm run deploy` | Ручной deploy через wrangler |
