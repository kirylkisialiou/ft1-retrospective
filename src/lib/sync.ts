import type { RetroState } from '../types'

/** Active room: poll often. Archived: still live-ish, lighter. */
export const POLL_ACTIVE_MS = 2500
export const POLL_ARCHIVED_MS = 6000
export const POLL_BACKOFF_MAX_MS = 20000

/** Cheap fingerprint so we skip setState when nothing changed. */
export function stateFingerprint(state: RetroState): string {
  const cards = state.cards.map((c) => `${c.id}:${c.source}`).join(',')
  const seats = state.seats
    .map((s) => `${s.seatIndex}:${s.occupied ? s.displayName : ''}:${s.isMine ? 1 : 0}`)
    .join('|')
  const history = state.history.map((h) => `${h.slug}:${h.cardCount}:${h.status}`).join(',')
  return [
    state.revision ?? '',
    state.sprint.id,
    state.sprint.slug,
    state.sprint.number,
    state.sprint.status,
    state.readOnly ? 1 : 0,
    state.lastDeal?.createdAt ?? '',
    cards,
    seats,
    history,
  ].join('#')
}

export function nextBackoff(current: number): number {
  return Math.min(POLL_BACKOFF_MAX_MS, Math.max(POLL_ACTIVE_MS, current * 1.6))
}
