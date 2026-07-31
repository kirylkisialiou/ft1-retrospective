import type { Category, RetroState } from '../types'
import { localApi } from './localStore'
import { getOccupantToken } from './occupant'

/** Only hard-fail over to localStorage after mutations can't reach the API. */
let preferLocal = false

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!res.ok) {
    const message =
      typeof payload === 'object' &&
      payload &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : text || `HTTP ${res.status}`
    throw new Error(message)
  }

  return payload as T
}

async function withFallback<T>(
  remote: () => Promise<T>,
  local: () => Promise<T>,
): Promise<{ data: T; mode: 'remote' | 'local' }> {
  if (preferLocal) {
    return { data: await local(), mode: 'local' }
  }
  try {
    const data = await remote()
    return { data, mode: 'remote' }
  } catch {
    preferLocal = true
    return { data: await local(), mode: 'local' }
  }
}

export type StorageMode = 'remote' | 'local' | 'loading'

function token() {
  return getOccupantToken()
}

function stateQuery(ref?: string | null) {
  const params = new URLSearchParams()
  params.set('token', token())
  if (ref) {
    params.set('slug', ref)
    params.set('sprintId', ref)
  }
  return params
}

export const api = {
  /**
   * Fetch board state.
   * - soft: poll path — never permanently lock to localStorage; throw on remote error
   *   so the UI keeps the last good remote snapshot.
   */
  async getState(ref?: string | null, opts?: { soft?: boolean }) {
    const t = token()
    const params = stateQuery(ref)

    if (opts?.soft) {
      if (preferLocal) {
        return {
          data: await localApi.getState(ref, t),
          mode: 'local' as const,
        }
      }
      const data = await request<RetroState>(`/api/state?${params}`)
      return { data, mode: 'remote' as const }
    }

    return withFallback(
      () => request<RetroState>(`/api/state?${params}`),
      () => localApi.getState(ref, t),
    )
  },

  /** After a successful remote mutation, allow polls to use the API again. */
  markRemoteOk() {
    preferLocal = false
  },

  async addCard(input: {
    category: Category
    title: string
    body: string
    author: string
  }) {
    const result = await withFallback(
      () =>
        request<RetroState>('/api/cards', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      () => localApi.addCard(input),
    )
    if (result.mode === 'remote') preferLocal = false
    return result
  },

  async deleteCard(id: string) {
    const result = await withFallback(
      () =>
        request<RetroState>(`/api/cards?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
      () => localApi.deleteCard(id),
    )
    if (result.mode === 'remote') preferLocal = false
    return result
  },

  async updateSprint(patch: { number?: number }) {
    const t = token()
    const result = await withFallback(
      () =>
        request<RetroState>('/api/sprint', {
          method: 'PATCH',
          body: JSON.stringify({ ...patch, token: t }),
        }),
      () => localApi.updateSprint(patch),
    )
    if (result.mode === 'remote') preferLocal = false
    return result
  },

  async closeSprint() {
    const t = token()
    const result = await withFallback(
      () =>
        request<RetroState>(
          `/api/sprint?action=close&token=${encodeURIComponent(t)}`,
          { method: 'POST' },
        ),
      () => localApi.closeSprint(t),
    )
    if (result.mode === 'remote') preferLocal = false
    return result
  },

  async dealFromCampfire() {
    const result = await withFallback(
      () => request<RetroState>('/api/deal', { method: 'POST' }),
      () => localApi.dealFromCampfire(),
    )
    if (result.mode === 'remote') preferLocal = false
    return result
  },

  async claimSeat(input: {
    seatIndex: number
    displayName: string
    ref?: string | null
  }) {
    const t = token()
    const result = await withFallback(
      () =>
        request<RetroState>('/api/seats', {
          method: 'POST',
          body: JSON.stringify({
            seatIndex: input.seatIndex,
            displayName: input.displayName,
            token: t,
            slug: input.ref,
            sprintId: input.ref,
          }),
        }),
      () =>
        localApi.claimSeat({
          seatIndex: input.seatIndex,
          displayName: input.displayName,
          token: t,
          ref: input.ref,
        }),
    )
    if (result.mode === 'remote') preferLocal = false
    return result
  },

  async leaveSeat(ref?: string | null) {
    const t = token()
    const params = new URLSearchParams({ token: t })
    if (ref) {
      params.set('slug', ref)
      params.set('sprintId', ref)
    }
    const result = await withFallback(
      () =>
        request<RetroState>(`/api/seats?${params}`, {
          method: 'DELETE',
        }),
      () => localApi.leaveSeat({ token: t, ref }),
    )
    if (result.mode === 'remote') preferLocal = false
    return result
  },
}
