import type { Category, RetroState } from '../types'
import { localApi } from './localStore'

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

export const api = {
  async getState(sprintId?: string | null) {
    const query = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : ''
    return withFallback(
      () => request<RetroState>(`/api/state${query}`),
      () => localApi.getState(sprintId),
    )
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
    return withFallback(
      () =>
        request<RetroState>('/api/sprint', {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      () => localApi.updateSprint(patch),
    )
  },

  async closeSprint() {
    return withFallback(
      () =>
        request<RetroState>('/api/sprint?action=close', {
          method: 'POST',
        }),
      () => localApi.closeSprint(),
    )
  },

  async dealFromCampfire() {
    return withFallback(
      () => request<RetroState>('/api/deal', { method: 'POST' }),
      () => localApi.dealFromCampfire(),
    )
  },
}
