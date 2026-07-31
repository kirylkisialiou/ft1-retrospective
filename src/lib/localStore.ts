import { APP_NAME } from '../types'
import type {
  LastDeal,
  RetroCard,
  RetroState,
  SprintMeta,
  SprintSummary,
} from '../types'
import { drawCampfireHand } from './deal'
import { createId } from './id'

const KEY = 'ft1-retrospective-v2'

interface Store {
  sprints: SprintMeta[]
  cards: Record<string, RetroCard[]>
  deals: Record<string, LastDeal | null>
  viewingId: string | null
}

function now() {
  return new Date().toISOString()
}

function makeSprint(number: number): SprintMeta {
  return {
    id: createId(),
    number,
    title: APP_NAME,
    status: 'active',
    createdAt: now(),
    archivedAt: null,
  }
}

function defaultStore(): Store {
  const sprint = makeSprint(1)
  return {
    sprints: [sprint],
    cards: { [sprint.id]: [] },
    deals: { [sprint.id]: null },
    viewingId: null,
  }
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw) as Store
    if (!parsed.sprints?.length) return defaultStore()
    return parsed
  } catch {
    return defaultStore()
  }
}

function writeStore(store: Store): Store {
  localStorage.setItem(KEY, JSON.stringify(store))
  return store
}

function activeSprint(store: Store): SprintMeta {
  const active = store.sprints.find((s) => s.status === 'active')
  if (active) return active
  const created = makeSprint(1)
  store.sprints.push(created)
  store.cards[created.id] = []
  store.deals[created.id] = null
  writeStore(store)
  return created
}

function history(store: Store): SprintSummary[] {
  return [...store.sprints]
    .sort((a, b) => b.number - a.number)
    .map((s) => ({
      ...s,
      cardCount: (store.cards[s.id] ?? []).length,
    }))
}

function toState(store: Store, sprintId?: string | null): RetroState {
  const active = activeSprint(store)
  const sprint =
    (sprintId && store.sprints.find((s) => s.id === sprintId)) || active
  return {
    sprint,
    cards: store.cards[sprint.id] ?? [],
    lastDeal: store.deals[sprint.id] ?? null,
    history: history(store),
    readOnly: sprint.status !== 'active',
  }
}

export const localApi = {
  async getState(sprintId?: string | null): Promise<RetroState> {
    const store = readStore()
    if (sprintId !== undefined) store.viewingId = sprintId
    writeStore(store)
    return toState(store, store.viewingId)
  },

  async addCard(input: {
    category: RetroCard['category']
    title: string
    body: string
    author: string
  }): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    const card: RetroCard = {
      id: createId(),
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      author: input.author.trim() || 'Странник',
      source: 'human',
      createdAt: now(),
    }
    store.cards[active.id] = [card, ...(store.cards[active.id] ?? [])]
    store.viewingId = null
    writeStore(store)
    return toState(store)
  },

  async deleteCard(id: string): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    store.cards[active.id] = (store.cards[active.id] ?? []).filter(
      (c) => c.id !== id,
    )
    store.viewingId = null
    writeStore(store)
    return toState(store)
  },

  async updateSprint(patch: { number?: number }): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    if (typeof patch.number === 'number' && patch.number > 0) {
      const number = Math.floor(patch.number)
      if (store.sprints.some((s) => s.number === number && s.id !== active.id)) {
        throw new Error(`Спринт #${number} уже есть в истории`)
      }
      active.number = number
    }
    writeStore(store)
    return toState(store)
  },

  async closeSprint(): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    active.status = 'archived'
    active.archivedAt = now()
    const next = makeSprint(active.number + 1)
    store.sprints.push(next)
    store.cards[next.id] = []
    store.deals[next.id] = null
    store.viewingId = null
    writeStore(store)
    return toState(store)
  },

  async dealFromCampfire(): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    const existing = store.cards[active.id] ?? []
    const { cards, summary } = drawCampfireHand(existing)
    store.cards[active.id] = [...cards, ...existing]
    store.deals[active.id] = {
      summary,
      cardIds: cards.map((c) => c.id),
      createdAt: now(),
    }
    store.viewingId = null
    writeStore(store)
    return toState(store)
  },
}
