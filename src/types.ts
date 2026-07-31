export type Category = 'plus' | 'minus' | 'thanks' | 'improve'

export type CardSource = 'human' | 'camp'

export type SprintStatus = 'active' | 'archived'

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
  title: string
  status: SprintStatus
  createdAt: string
  archivedAt: string | null
}

export interface SprintSummary {
  id: string
  number: number
  title: string
  status: SprintStatus
  createdAt: string
  archivedAt: string | null
  cardCount: number
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
  readOnly: boolean
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
