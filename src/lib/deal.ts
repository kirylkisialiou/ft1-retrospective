import { CAMPFIRE_DECK } from '../data/campfireDeck'
import type { CampPrompt } from '../data/campfireDeck'
import type { Category, RetroCard } from '../types'
import { CATEGORY_LABEL } from '../types'
import { createId } from './id'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Берём по одной карте на категорию из колоды у костра. */
export function drawCampfireHand(existing: RetroCard[]): {
  cards: RetroCard[]
  summary: string
} {
  const usedTitles = new Set(existing.map((c) => c.title))
  const byCategory = new Map<Category, CampPrompt[]>()

  for (const prompt of shuffle(CAMPFIRE_DECK)) {
    if (usedTitles.has(prompt.title)) continue
    const list = byCategory.get(prompt.category) ?? []
    list.push(prompt)
    byCategory.set(prompt.category, list)
  }

  const categories: Category[] = ['minus', 'plus', 'thanks', 'improve']
  const now = new Date().toISOString()
  const cards: RetroCard[] = []

  for (const category of categories) {
    const pool = byCategory.get(category) ?? []
    const prompt =
      pool[0] ??
      shuffle(CAMPFIRE_DECK.filter((p) => p.category === category))[0]
    if (!prompt) continue
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

  const labels = cards.map((c) => CATEGORY_LABEL[c.category]).join(', ')
  const summary = `У костра раздали ${cards.length}: ${labels}. Огонь слушает, Jira наблюдает.`

  return { cards, summary }
}
