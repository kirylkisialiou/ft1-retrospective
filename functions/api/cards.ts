import type { Env } from '../types'
import { error, getActiveSprint, json, loadState } from '../lib/state'

const CATEGORIES = new Set(['plus', 'minus', 'thanks', 'improve'])

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      category?: string
      title?: string
      body?: string
      author?: string
    }

    if (!body.category || !CATEGORIES.has(body.category)) {
      return error('Неверная категория')
    }
    const title = (body.title ?? '').trim()
    if (!title) return error('Нужен заголовок карты')

    const active = await getActiveSprint(context.env)
    const id = crypto.randomUUID()
    await context.env.DB.prepare(
      `INSERT INTO cards (id, sprint_id, category, title, body, author, source)
       VALUES (?, ?, ?, ?, ?, ?, 'human')`,
    )
      .bind(
        id,
        active.id,
        body.category,
        title,
        (body.body ?? '').trim(),
        (body.author ?? '').trim() || 'Странник',
      )
      .run()

    return json(await loadState(context.env))
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Failed to add card', 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    if (!id) return error('Нужен id карты')

    const active = await getActiveSprint(context.env)
    const result = await context.env.DB.prepare(
      `DELETE FROM cards WHERE id = ? AND sprint_id = ?`,
    )
      .bind(id, active.id)
      .run()

    if (!result.meta.changes) {
      return error('Карту можно удалить только в текущем спринте', 403)
    }

    return json(await loadState(context.env))
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Failed to delete card', 500)
  }
}
