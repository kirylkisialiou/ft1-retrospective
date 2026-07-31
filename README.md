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
- На Cloudflare Pages SPA-fallback: `public/_redirects` (`/* → /index.html`).

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

4. In Cloudflare Dashboard → your Pages project → **Settings → Bindings**:
   - Type: **D1 database**
   - Variable name: **`DB`** (must match the code)
   - Database: **`ft1-retro`** (same DB as above)

5. Commit/push the real `database_id` (or rely on the dashboard binding alone — both should point at the same DB).

Without a D1 binding the site still loads; the app falls back to `localStorage` per browser.

Папка `functions/` → Pages Functions (`/api/state`, `/api/cards`, `/api/deal`, `/api/sprint`).

## Скрипты

| Команда | Что делает |
|--------|------------|
| `npm run dev` | Vite + localStorage |
| `npm run build` | Typecheck + `dist` |
| `npm run db:remote` | Схема в D1 |
| `npm run deploy` | Ручной deploy через wrangler |
