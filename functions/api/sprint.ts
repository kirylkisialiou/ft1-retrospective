import type { Env } from '../types'
import { error, getActiveSprint, json, loadState } from '../lib/state'

const APP_TITLE = 'FT1 - Retrospective'

/** Update active sprint number (title stays branded). */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as { number?: number }
    const active = await getActiveSprint(context.env)

    if (typeof body.number === 'number' && body.number > 0) {
      const number = Math.floor(body.number)
      const clash = await context.env.DB.prepare(
        `SELECT id FROM sprints WHERE number = ? AND id != ? LIMIT 1`,
      )
        .bind(number, active.id)
        .first()
      if (clash) return error(`Спринт #${number} уже есть в истории`)

      await context.env.DB.prepare(
        `UPDATE sprints SET number = ? WHERE id = ? AND status = 'active'`,
      )
        .bind(number, active.id)
        .run()
    }

    return json(await loadState(context.env))
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Failed to update sprint', 500)
  }
}

/** Archive current sprint and open the next empty one. */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const action = url.searchParams.get('action')
    if (action !== 'close') {
      return error('Используй POST /api/sprint?action=close')
    }

    const active = await getActiveSprint(context.env)
    const nextNumber = active.number + 1
    const nextId = crypto.randomUUID()

    await context.env.DB.batch([
      context.env.DB.prepare(
        `UPDATE sprints
         SET status = 'archived', archived_at = datetime('now')
         WHERE id = ? AND status = 'active'`,
      ).bind(active.id),
      context.env.DB.prepare(
        `INSERT INTO sprints (id, number, title, status)
         VALUES (?, ?, ?, 'active')`,
      ).bind(nextId, nextNumber, APP_TITLE),
    ])

    return json(await loadState(context.env))
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Failed to close sprint', 500)
  }
}
