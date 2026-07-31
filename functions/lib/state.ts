import type { DbCard, DbDeal, DbSeat, DbSprint, DbSprintCount, Env } from '../types'

const APP_TITLE = 'FT1 - Retrospective'
const SEAT_COUNT = 8

function mapCard(row: DbCard) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    author: row.author,
    source: row.source,
    createdAt: row.created_at,
  }
}

function mapSprint(row: DbSprint) {
  return {
    id: row.id,
    number: row.number,
    slug: row.slug,
    title: row.title,
    status: row.status as 'active' | 'archived',
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  }
}

function slugFor(number: number) {
  return `s-${number}`
}

async function ensureActiveSprint(env: Env): Promise<DbSprint> {
  const active = await env.DB.prepare(
    `SELECT id, number, slug, title, status, created_at, archived_at
     FROM sprints WHERE status = 'active' LIMIT 1`,
  ).first<DbSprint>()

  if (active) return active

  const id = crypto.randomUUID()
  const slug = slugFor(1)
  await env.DB.prepare(
    `INSERT INTO sprints (id, number, slug, title, status) VALUES (?, 1, ?, ?, 'active')`,
  )
    .bind(id, slug, APP_TITLE)
    .run()

  return {
    id,
    number: 1,
    slug,
    title: APP_TITLE,
    status: 'active',
    created_at: new Date().toISOString(),
    archived_at: null,
  }
}

async function loadHistory(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.number, s.slug, s.title, s.status, s.created_at, s.archived_at,
            COUNT(c.id) AS card_count
     FROM sprints s
     LEFT JOIN cards c ON c.sprint_id = s.id
     GROUP BY s.id
     ORDER BY s.number DESC`,
  ).all<DbSprintCount>()

  return (results ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    slug: row.slug,
    title: row.title,
    status: row.status as 'active' | 'archived',
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    cardCount: Number(row.card_count) || 0,
  }))
}

async function loadSeats(env: Env, sprintId: string, token?: string | null) {
  const { results } = await env.DB.prepare(
    `SELECT seat_index, occupant_token, display_name, claimed_at
     FROM seats WHERE sprint_id = ? ORDER BY seat_index ASC`,
  )
    .bind(sprintId)
    .all<DbSeat>()

  const byIndex = new Map(
    (results ?? []).map((row) => [row.seat_index, row] as const),
  )

  return Array.from({ length: SEAT_COUNT }, (_, seatIndex) => {
    const row = byIndex.get(seatIndex)
    return {
      seatIndex,
      displayName: row?.display_name ?? '',
      occupied: Boolean(row),
      isMine: Boolean(row && token && row.occupant_token === token),
    }
  })
}

export class SprintNotFoundError extends Error {
  readonly code = 'SPRINT_NOT_FOUND' as const

  constructor(
    public requested: string,
    public activeSlug: string,
    public sprints: Array<{
      slug: string
      number: number
      status: 'active' | 'archived'
    }>,
  ) {
    super(`Спринт «${requested}» не найден`)
    this.name = 'SprintNotFoundError'
  }
}

async function notFound(
  env: Env,
  requested: string,
  active: DbSprint,
): Promise<never> {
  const history = await loadHistory(env)
  throw new SprintNotFoundError(
    requested,
    active.slug,
    history.map((s) => ({
      slug: s.slug,
      number: s.number,
      status: s.status,
    })),
  )
}

export async function resolveSprint(
  env: Env,
  opts: { sprintId?: string | null; slug?: string | null },
): Promise<DbSprint> {
  const active = await ensureActiveSprint(env)
  const requestedSlug = opts.slug?.trim() || null
  const requestedId = opts.sprintId?.trim() || null

  if (requestedSlug) {
    const bySlug = await env.DB.prepare(
      `SELECT id, number, slug, title, status, created_at, archived_at
       FROM sprints WHERE slug = ?`,
    )
      .bind(requestedSlug)
      .first<DbSprint>()
    if (bySlug) return bySlug
    await notFound(env, requestedSlug, active)
  }

  if (requestedId) {
    const byId = await env.DB.prepare(
      `SELECT id, number, slug, title, status, created_at, archived_at
       FROM sprints WHERE id = ?`,
    )
      .bind(requestedId)
      .first<DbSprint>()
    if (byId) return byId
    await notFound(env, requestedId, active)
  }

  return active
}

function requireDb(env: Env): D1Database {
  if (!env.DB) {
    throw new Error(
      'D1 binding DB is missing. In Pages → Settings → Bindings add D1 variable name "DB" → ft1-retro (also set [[env.production.d1_databases]] in wrangler.toml).',
    )
  }
  return env.DB
}

export async function loadState(
  env: Env,
  opts: {
    sprintId?: string | null
    slug?: string | null
    token?: string | null
  } = {},
) {
  requireDb(env)
  const sprint = await resolveSprint(env, opts)

  const { results: cards } = await env.DB.prepare(
    `SELECT id, sprint_id, category, title, body, author, source, created_at
     FROM cards WHERE sprint_id = ?
     ORDER BY datetime(created_at) DESC`,
  )
    .bind(sprint.id)
    .all<DbCard>()

  const last = await env.DB.prepare(
    `SELECT summary, card_ids, created_at FROM deals
     WHERE sprint_id = ? ORDER BY id DESC LIMIT 1`,
  )
    .bind(sprint.id)
    .first<DbDeal>()

  const seats = await loadSeats(env, sprint.id, opts.token)
  const mappedCards = (cards ?? []).map(mapCard)
  const lastDeal = last
    ? {
        summary: last.summary,
        cardIds: JSON.parse(last.card_ids || '[]') as string[],
        createdAt: last.created_at,
      }
    : null

  const revisionParts = [
    sprint.id,
    sprint.status,
    String(sprint.number),
    sprint.archived_at ?? '',
    lastDeal?.createdAt ?? '',
    ...mappedCards.map((c) => `${c.id}:${c.createdAt}`),
    ...seats.map(
      (s) => `${s.seatIndex}:${s.occupied ? s.displayName : ''}`,
    ),
  ]

  return {
    sprint: mapSprint(sprint),
    cards: mappedCards,
    lastDeal,
    history: await loadHistory(env),
    seats,
    readOnly: sprint.status !== 'active',
    revision: revisionParts.join('|'),
  }
}

export async function getActiveSprint(env: Env): Promise<DbSprint> {
  return ensureActiveSprint(env)
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}

export { slugFor, SEAT_COUNT }
