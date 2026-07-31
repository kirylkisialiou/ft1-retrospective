import { createId } from './id'

const TOKEN_KEY = 'ft1-occupant-token'
const NAME_KEY = 'ft1-display-name'

export function getOccupantToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      token = createId()
      localStorage.setItem(TOKEN_KEY, token)
    }
    return token
  } catch {
    return createId()
  }
}

export function getSavedDisplayName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveDisplayName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.trim())
  } catch {
    /* ignore */
  }
}
