import type { DbCard, DbDeal, DbSprint, DbSprintCount, Env } from '../types'

const APP_TITLE = 'FT1 - Retrospective'

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
    title: row.title,
    status: row.status as 'active' | 'archived',
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  }
}

async function ensureActiveSprint(env: Env): Promise<DbSprint> {
  const active = await env.DB.prepare(
    `SELECT id, number, title, status, created_at, archived_at
     FROM sprints WHERE status = 'active' LIMIT 1`,
  ).first<DbSprint>()

  if (active) return active

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO sprints (id, number, title, status) VALUES (?, 1, ?, 'active')`,
  )
    .bind(id, APP_TITLE)
    .run()

  return {
    id,
    number: 1,
    title: APP_TITLE,
    status: 'active',
    created_at: new Date().toISOString(),
    archived_at: null,
  }
}

async function loadHistory(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.number, s.title, s.status, s.created_at, s.archived_at,
            COUNT(c.id) AS card_count
     FROM sprints s
     LEFT JOIN cards c ON c.sprint_id = s.id
     GROUP BY s.id
     ORDER BY s.number DESC`,
  ).all<DbSprintCount>()

  return (results ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status as 'active' | 'archived',
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    cardCount: Number(row.card_count) || 0,
  }))
}

export async function loadState(env: Env, sprintId?: string | null) {
  const active = await ensureActiveSprint(env)

  let sprint = active
  if (sprintId) {
    const requested = await env.DB.prepare(
      `SELECT id, number, title, status, created_at, archived_at
       FROM sprints WHERE id = ?`,
    )
      .bind(sprintId)
      .first<DbSprint>()
    if (requested) sprint = requested
  }

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

  return {
    sprint: mapSprint(sprint),
    cards: (cards ?? []).map(mapCard),
    lastDeal: last
      ? {
          summary: last.summary,
          cardIds: JSON.parse(last.card_ids || '[]') as string[],
          createdAt: last.created_at,
        }
      : null,
    history: await loadHistory(env),
    readOnly: sprint.status !== 'active',
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
