import type { Category, RetroState, SprintSummary } from '../types'
import { localApi } from './localStore'
import { getOccupantToken } from './occupant'

/** Sticky local only after API failures; always re-probe so D1 can recover. */
let preferLocal = false
let lastRemoteError: string | null = null

export function getLastRemoteError() {
  return lastRemoteError
}

export type SprintNotFoundPayload = {
  code: 'SPRINT_NOT_FOUND'
  error: string
  requested: string
  activeSlug: string
  sprints: Array<Pick<SprintSummary, 'slug' | 'number' | 'status'>>
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function asNotFoundPayload(value: unknown): SprintNotFoundPayload | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (body.code !== 'SPRINT_NOT_FOUND') return null
  if (typeof body.requested !== 'string' || typeof body.activeSlug !== 'string') {
    return null
  }
  return body as SprintNotFoundPayload
}

export function isSprintNotFound(err: unknown): err is ApiError & {
  body: SprintNotFoundPayload
} {
  if (err instanceof ApiError) {
    const payload = asNotFoundPayload(err.body)
    return Boolean(payload)
  }
  if (
    err &&
    typeof err === 'object' &&
    'sprintNotFound' in err &&
    asNotFoundPayload((err as { sprintNotFound: unknown }).sprintNotFound)
  ) {
    return true
  }
  return false
}

export function sprintNotFoundPayload(
  err: unknown,
): SprintNotFoundPayload | null {
  if (err instanceof ApiError) return asNotFoundPayload(err.body)
  if (err && typeof err === 'object' && 'sprintNotFound' in err) {
    return asNotFoundPayload(
      (err as { sprintNotFound: unknown }).sprintNotFound,
    )
  }
  return null
}

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
    throw new ApiError(message, res.status, payload)
  }

  return payload as T
}

async function withFallback<T>(
  remote: () => Promise<T>,
  local: () => Promise<T>,
): Promise<{ data: T; mode: 'remote' | 'local' }> {
  try {
    const data = await remote()
    preferLocal = false
    lastRemoteError = null
    return { data, mode: 'remote' }
  } catch (e) {
    if (isSprintNotFound(e)) throw e
    lastRemoteError = e instanceof Error ? e.message : 'API unavailable'
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
  async getState(ref?: string | null, opts?: { soft?: boolean }) {
    const t = token()
    const params = stateQuery(ref)

    if (opts?.soft) {
      try {
        const data = await request<RetroState>(`/api/state?${params}`)
        preferLocal = false
        lastRemoteError = null
        return { data, mode: 'remote' as const }
      } catch (e) {
        if (isSprintNotFound(e)) throw e
        lastRemoteError = e instanceof Error ? e.message : 'API unavailable'
        if (preferLocal) {
          return {
            data: await localApi.getState(ref, t),
            mode: 'local' as const,
          }
        }
        throw e
      }
    }

    try {
      return await withFallback(
        () => request<RetroState>(`/api/state?${params}`),
        () => localApi.getState(ref, t),
      )
    } catch (e) {
      const payload = sprintNotFoundPayload(e)
      if (payload) {
        throw new ApiError(payload.error, 404, payload)
      }
      throw e
    }
  },

  markRemoteOk() {
    preferLocal = false
    lastRemoteError = null
  },

  async addCard(input: {
    category: Category
    title: string
    body: string
    author: string
  }) {
    return withFallback(
      () =>
        request<RetroState>('/api/cards', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      () => localApi.addCard(input),
    )
  },

  async deleteCard(id: string) {
    return withFallback(
      () =>
        request<RetroState>(`/api/cards?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
      () => localApi.deleteCard(id),
    )
  },

  async updateSprint(patch: { number?: number }) {
    const t = token()
    return withFallback(
      () =>
        request<RetroState>('/api/sprint', {
          method: 'PATCH',
          body: JSON.stringify({ ...patch, token: t }),
        }),
      () => localApi.updateSprint(patch),
    )
  },

  async closeSprint() {
    const t = token()
    return withFallback(
      () =>
        request<RetroState>(
          `/api/sprint?action=close&token=${encodeURIComponent(t)}`,
          { method: 'POST' },
        ),
      () => localApi.closeSprint(t),
    )
  },

  async dealFromCampfire() {
    return withFallback(
      () => request<RetroState>('/api/deal', { method: 'POST' }),
      () => localApi.dealFromCampfire(),
    )
  },

  async claimSeat(input: {
    seatIndex: number
    displayName: string
    ref?: string | null
  }) {
    const t = token()
    return withFallback(
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
  },

  async leaveSeat(ref?: string | null) {
    const t = token()
    const params = new URLSearchParams({ token: t })
    if (ref) {
      params.set('slug', ref)
      params.set('sprintId', ref)
    }
    return withFallback(
      () =>
        request<RetroState>(`/api/seats?${params}`, {
          method: 'DELETE',
        }),
      () => localApi.leaveSeat({ token: t, ref }),
    )
  },
}
