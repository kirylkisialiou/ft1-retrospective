import { APP_NAME, SEAT_COUNT, sprintSlug } from '../types'
import type {
  LastDeal,
  RetroCard,
  RetroState,
  Seat,
  SprintMeta,
  SprintSummary,
} from '../types'
import { drawCampfireHand } from './deal'
import { createId } from './id'

const KEY = 'ft1-retrospective-v3'

interface StoredSeat {
  seatIndex: number
  occupantToken: string
  displayName: string
}

interface Store {
  sprints: SprintMeta[]
  cards: Record<string, RetroCard[]>
  deals: Record<string, LastDeal | null>
  seats: Record<string, StoredSeat[]>
  viewingRef: string | null
}

function now() {
  return new Date().toISOString()
}

function makeSprint(number: number): SprintMeta {
  return {
    id: createId(),
    number,
    slug: sprintSlug(number),
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
    seats: { [sprint.id]: [] },
    viewingRef: null,
  }
}

function migrateSprint(raw: Partial<SprintMeta> & { id: string }): SprintMeta {
  return {
    id: raw.id,
    number: raw.number ?? 1,
    slug: raw.slug ?? sprintSlug(raw.number ?? 1),
    title: raw.title ?? APP_NAME,
    status: raw.status === 'archived' ? 'archived' : 'active',
    createdAt: raw.createdAt ?? now(),
    archivedAt: raw.archivedAt ?? null,
  }
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem('ft1-retrospective-v2')
    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw) as Partial<Store> & {
      sprints?: Array<Partial<SprintMeta> & { id: string }>
      viewingId?: string | null
    }
    if (!parsed.sprints?.length) return defaultStore()
    return {
      sprints: parsed.sprints.map(migrateSprint),
      cards: parsed.cards ?? {},
      deals: parsed.deals ?? {},
      seats: parsed.seats ?? {},
      viewingRef: parsed.viewingRef ?? parsed.viewingId ?? null,
    }
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
  store.seats[created.id] = []
  writeStore(store)
  return created
}

function findSprint(store: Store, ref?: string | null): SprintMeta | null {
  if (!ref) return null
  return (
    store.sprints.find((s) => s.id === ref || s.slug === ref) ?? null
  )
}

function history(store: Store): SprintSummary[] {
  return [...store.sprints]
    .sort((a, b) => b.number - a.number)
    .map((s) => ({
      ...s,
      cardCount: (store.cards[s.id] ?? []).length,
    }))
}

function mapSeats(store: Store, sprintId: string, token?: string | null): Seat[] {
  const rows = store.seats[sprintId] ?? []
  const byIndex = new Map(rows.map((r) => [r.seatIndex, r]))
  return Array.from({ length: SEAT_COUNT }, (_, seatIndex) => {
    const row = byIndex.get(seatIndex)
    return {
      seatIndex,
      displayName: row?.displayName ?? '',
      occupied: Boolean(row),
      isMine: Boolean(row && token && row.occupantToken === token),
    }
  })
}

function toState(
  store: Store,
  ref?: string | null,
  token?: string | null,
): RetroState {
  const active = activeSprint(store)
  const sprint = findSprint(store, ref) ?? active
  return {
    sprint,
    cards: store.cards[sprint.id] ?? [],
    lastDeal: store.deals[sprint.id] ?? null,
    history: history(store),
    seats: mapSeats(store, sprint.id, token),
    readOnly: sprint.status !== 'active',
  }
}

export const localApi = {
  async getState(
    ref?: string | null,
    token?: string | null,
  ): Promise<RetroState> {
    const store = readStore()
    if (ref !== undefined) store.viewingRef = ref
    writeStore(store)
    return toState(store, store.viewingRef, token)
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
    store.viewingRef = null
    writeStore(store)
    return toState(store, null, null)
  },

  async deleteCard(id: string): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    store.cards[active.id] = (store.cards[active.id] ?? []).filter(
      (c) => c.id !== id,
    )
    store.viewingRef = null
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
    return toState(store, active.id)
  },

  async closeSprint(token?: string | null): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    active.status = 'archived'
    active.archivedAt = now()
    let next = makeSprint(active.number + 1)
    if (store.sprints.some((s) => s.slug === next.slug)) {
      next = { ...next, slug: `${next.slug}-${next.id.slice(0, 6)}` }
    }
    store.sprints.push(next)
    store.cards[next.id] = []
    store.deals[next.id] = null
    store.seats[next.id] = []
    store.viewingRef = null
    writeStore(store)
    return toState(store, next.id, token)
  },

  async dealFromCampfire(): Promise<RetroState> {
    const store = readStore()
    const active = activeSprint(store)
    const existing = store.cards[active.id] ?? []
    const humanOnly = existing.filter((c) => c.source !== 'camp')
    const { cards, summary } = drawCampfireHand(existing)
    if (cards.length === 0) {
      throw new Error(summary)
    }
    store.cards[active.id] = [...cards, ...humanOnly]
    store.deals[active.id] = {
      summary,
      cardIds: cards.map((c) => c.id),
      createdAt: now(),
    }
    store.viewingRef = null
    writeStore(store)
    return toState(store, active.id)
  },

  async claimSeat(input: {
    seatIndex: number
    displayName: string
    token: string
    ref?: string | null
  }): Promise<RetroState> {
    const store = readStore()
    const sprint = findSprint(store, input.ref) ?? activeSprint(store)
    if (sprint.status !== 'active') {
      throw new Error('В архиве места уже заняты историей — только просмотр')
    }
    if (input.seatIndex < 0 || input.seatIndex >= SEAT_COUNT) {
      throw new Error('За столом только 8 мест')
    }
    const name = input.displayName.trim()
    if (!name) throw new Error('Как тебя зовут у костра?')

    let seats = (store.seats[sprint.id] ?? []).filter(
      (s) => s.occupantToken !== input.token,
    )
    const occupied = seats.find((s) => s.seatIndex === input.seatIndex)
    if (occupied && occupied.occupantToken !== input.token) {
      throw new Error('Это место уже занято')
    }
    seats = seats.filter((s) => s.seatIndex !== input.seatIndex)
    seats.push({
      seatIndex: input.seatIndex,
      occupantToken: input.token,
      displayName: name,
    })
    store.seats[sprint.id] = seats
    store.viewingRef = sprint.slug
    writeStore(store)
    return toState(store, sprint.slug, input.token)
  },

  async leaveSeat(input: {
    token: string
    ref?: string | null
  }): Promise<RetroState> {
    const store = readStore()
    const sprint = findSprint(store, input.ref) ?? activeSprint(store)
    if (sprint.status !== 'active') {
      throw new Error('В архиве нельзя вставать — это уже история')
    }
    store.seats[sprint.id] = (store.seats[sprint.id] ?? []).filter(
      (s) => s.occupantToken !== input.token,
    )
    store.viewingRef = sprint.slug
    writeStore(store)
    return toState(store, sprint.slug, input.token)
  },
}
