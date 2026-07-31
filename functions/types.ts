export interface Env {
  DB: D1Database
}

export type Category = 'plus' | 'minus' | 'thanks' | 'improve'
export type CardSource = 'human' | 'camp'

export interface DbCard {
  id: string
  sprint_id: string
  category: string
  title: string
  body: string
  author: string
  source: string
  created_at: string
}

export interface DbSprint {
  id: string
  number: number
  slug: string
  title: string
  status: string
  created_at: string
  archived_at: string | null
}

export interface DbDeal {
  summary: string
  card_ids: string
  created_at: string
}

export interface DbSprintCount {
  id: string
  number: number
  slug: string
  title: string
  status: string
  created_at: string
  archived_at: string | null
  card_count: number
}

export interface DbSeat {
  seat_index: number
  occupant_token: string
  display_name: string
  claimed_at: string
}
