export type Category = 'plus' | 'minus' | 'thanks' | 'improve'

export type CardSource = 'human' | 'camp'

export type SprintStatus = 'active' | 'archived'

export const SEAT_COUNT = 8

export interface RetroCard {
  id: string
  category: Category
  title: string
  body: string
  author: string
  source: CardSource
  createdAt: string
}

export interface SprintMeta {
  id: string
  number: number
  slug: string
  title: string
  status: SprintStatus
  createdAt: string
  archivedAt: string | null
}

export interface SprintSummary {
  id: string
  number: number
  slug: string
  title: string
  status: SprintStatus
  createdAt: string
  archivedAt: string | null
  cardCount: number
}

export interface Seat {
  seatIndex: number
  displayName: string
  occupied: boolean
  /** True if this browser owns the seat (matched by occupant token). */
  isMine: boolean
}

export interface LastDeal {
  summary: string
  cardIds: string[]
  createdAt: string
}

export interface RetroState {
  sprint: SprintMeta
  cards: RetroCard[]
  lastDeal: LastDeal | null
  history: SprintSummary[]
  seats: Seat[]
  readOnly: boolean
  /** Server/client revision for cheap poll diffs (ISO or composite). */
  revision: string
}

export const APP_NAME = 'FT1 - Retrospective'

export const CATEGORIES: {
  id: Category
  label: string
  suit: string
}[] = [
  { id: 'plus', label: 'Плюсы', suit: '♥' },
  { id: 'minus', label: 'Минусы', suit: '♠' },
  { id: 'thanks', label: 'Спасибо', suit: '♦' },
  { id: 'improve', label: 'Улучшить', suit: '♣' },
]

export const CATEGORY_LABEL: Record<Category, string> = {
  plus: 'плюс',
  minus: 'минус',
  thanks: 'спасибо',
  improve: 'улучшить',
}

export function sprintSlug(number: number): string {
  return `s-${number}`
}

export function roomPath(slug: string): string {
  return `/s/${encodeURIComponent(slug)}`
}
