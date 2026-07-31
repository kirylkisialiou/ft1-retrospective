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

## Комнаты и ссылки

Каждый спринт имеет стабильный slug и URL вида **`/s/s-12`**.

- Открытая комната — можно добавлять карты и садиться за стол.
- Архив — только просмотр обсуждения (и кто сидел).
- Кнопка **«Ссылка на комнату»** копирует полный URL.
- На Cloudflare Pages SPA-fallback только для комнат: `public/_redirects` (`/s/* → /index.html`). `/api/*` идёт в Functions (`public/_routes.json`).

## Места за столом

До **8** мест. Садишься с display name (без логина). Место и имя хранятся в D1 / localStorage, привязаны к спринту. Новые карты от твоего места подписываются твоим именем.

## История спринтов

1. В текущем спринте добавляете карты как обычно.
2. **Закрыть спринт** — архивирует текущий (ссылка `/s/...` остаётся) и создаёт следующий.
3. В блоке **История** открываете прошлый спринт или возвращаетесь к текущему.

Схема: `sprints` (+ `slug`) + `cards` + `deals` + `seats` (см. `schema.sql`).

## Cloudflare Pages + GitHub (autodeploy)

### Build settings

| Setting | Value |
|--------|--------|
| Framework preset | Vite (или None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

### D1 database (required for shared persistence)

**Do not put a fake `database_id` like `local-ft1-retro` in `wrangler.toml`** — Pages deploy fails with `Error 8000022`.

1. Login and create the database (once):

```bash
cd /Users/kirylkisialiou/ft1-retro-jackpot
npx wrangler login
npx wrangler d1 create ft1-retro
```

2. Copy the printed UUID into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ft1-retro"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

3. Apply schema:

```bash
npx wrangler d1 execute ft1-retro --remote --file=./schema.sql
```

4. **Critical — D1 must be bound on the Pages project** (otherwise `/api/*` returns 500 `DB.prepare` and the UI falls back to localStorage with no cross-browser sync):

   Dashboard → **Workers & Pages** → `ft1-retrospective` → **Settings** → **Bindings** → **Add** → **D1 database**:
   - Variable name: **`DB`**
   - Database: **`ft1-retro`**
   - Apply to **Production** and **Preview**

   Also keep `[[env.production.d1_databases]]` / `[[env.preview.d1_databases]]` in `wrangler.toml` (Git deploys read env-scoped bindings).

5. Quick check: `curl https://ft1-retrospective.pages.dev/api/state` must return JSON with `cards`/`seats`, not `{"error":"...prepare..."}`.

Without a D1 binding the site still loads; the app falls back to `localStorage` per browser (banner warns).

Папка `functions/` → Pages Functions (`/api/state`, `/api/cards`, `/api/deal`, `/api/sprint`).

### Deploy failed uploading assets (`Failed to publish assets` / empty `Error: {}`)

Сборка `dist` у нас ~260KB — это не размер файлов. Обычно это **сбой Cloudflare API** на `pages/assets/upload` (522/502, differential upload). Сейчас status часто показывает degraded performance.

Что делать:
1. В Dashboard → Pages → **Retry deployment** (часто проходит со 2–3 раза).
2. Или локально, когда API живой: `npm run deploy:nocache` (`--skip-caching` обходит баг differential upload).
3. Не катить destructive `schema.sql` ради этого — к upload assets это не относится.

## Скрипты

| Команда | Что делает |
|--------|------------|
| `npm run dev` | Vite + localStorage |
| `npm run build` | Typecheck + `dist` |
| `npm run db:remote` | Схема в D1 (destructive) |
| `npm run db:migrate` | Безопасная миграция seats/slug |
| `npm run deploy` | Ручной Pages deploy |
| `npm run deploy:nocache` | Deploy без asset cache (если upload флапает) |
