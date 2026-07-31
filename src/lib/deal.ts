import { CAMPFIRE_DECK } from '../data/campfireDeck'
import type { CampPrompt } from '../data/campfireDeck'
import type { Category, RetroCard } from '../types'
import { CATEGORIES, CATEGORY_LABEL } from '../types'
import { createId } from './id'

/** Сколько карт в колонке считаем «достаточно» для разговора. */
export const COLUMN_TARGET = 2

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Раздача у костра:
 * 1) старые карты колоды (source=camp) отбрасываются;
 * 2) в каждой колонке, где своих (human) карт меньше COLUMN_TARGET,
 *    докладываем колодой до COLUMN_TARGET;
 * 3) полные колонки не трогаем — спама нет.
 */
export function drawCampfireHand(existing: RetroCard[]): {
  cards: RetroCard[]
  summary: string
  removedCamp: boolean
} {
  const human = existing.filter((c) => c.source === 'human')
  const usedTitles = new Set(human.map((c) => c.title))
  const pools = new Map<Category, CampPrompt[]>()

  for (const prompt of shuffle(CAMPFIRE_DECK)) {
    if (usedTitles.has(prompt.title)) continue
    const list = pools.get(prompt.category) ?? []
    list.push(prompt)
    pools.set(prompt.category, list)
  }

  const now = new Date().toISOString()
  const cards: RetroCard[] = []

  for (const cat of CATEGORIES) {
    const humanInCol = human.filter((c) => c.category === cat.id).length
    const need = Math.max(0, COLUMN_TARGET - humanInCol)
    if (need === 0) continue

    const pool = pools.get(cat.id) ?? []
    const fallback = shuffle(
      CAMPFIRE_DECK.filter((p) => p.category === cat.id),
    )
    const source = pool.length ? pool : fallback

    for (let i = 0; i < need; i += 1) {
      const prompt = source[i]
      if (!prompt) break
      cards.push({
        id: createId(),
        category: prompt.category,
        title: prompt.title,
        body: prompt.body,
        author: 'Колода у костра',
        source: 'camp',
        createdAt: now,
      })
    }
  }

  const labels = [...new Set(cards.map((c) => CATEGORY_LABEL[c.category]))].join(
    ', ',
  )
  const summary =
    cards.length === 0
      ? 'Во всех колонках уже достаточно своих карт — колода отдыхает.'
      : `У костра раздали ${cards.length}: ${labels}.`

  return {
    cards,
    summary,
    removedCamp: existing.some((c) => c.source === 'camp'),
  }
}

export function canDeal(existing: RetroCard[]): boolean {
  const human = existing.filter((c) => c.source === 'human')
  return CATEGORIES.some((cat) => {
    const n = human.filter((c) => c.category === cat.id).length
    return n < COLUMN_TARGET
  })
}
