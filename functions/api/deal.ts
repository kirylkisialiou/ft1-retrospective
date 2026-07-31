import { drawCampfireHand } from '../lib/campfireDeck'
import type { Env } from '../types'
import { error, getActiveSprint, json, loadState } from '../lib/state'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const active = await getActiveSprint(context.env)
    const state = await loadState(context.env)

    // Старые карты колоды убираем — повторный клик не копит спам.
    await context.env.DB.prepare(
      `DELETE FROM cards WHERE sprint_id = ? AND source = 'camp'`,
    )
      .bind(active.id)
      .run()

    const remaining = state.cards.filter((c) => c.source !== 'camp')
    const { cards, summary } = drawCampfireHand(
      remaining.map((c) => ({
        category: c.category,
        title: c.title,
        source: c.source,
      })),
    )

    if (cards.length === 0) {
      return error(summary, 409)
    }

    const ids: string[] = []
    for (const card of cards) {
      const id = crypto.randomUUID()
      ids.push(id)
      await context.env.DB.prepare(
        `INSERT INTO cards (id, sprint_id, category, title, body, author, source)
         VALUES (?, ?, ?, ?, ?, 'Колода у костра', 'camp')`,
      )
        .bind(id, active.id, card.category, card.title, card.body)
        .run()
    }

    await context.env.DB.prepare(
      `INSERT INTO deals (sprint_id, summary, card_ids) VALUES (?, ?, ?)`,
    )
      .bind(active.id, summary, JSON.stringify(ids))
      .run()

    return json(await loadState(context.env))
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Failed to deal', 500)
  }
}
