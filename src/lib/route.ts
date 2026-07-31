/** Path-based room URLs: /s/:slug — works with public/_redirects on Pages. */

export function parseRoomSlug(pathname = window.location.pathname): string | null {
  const match = pathname.match(/^\/s\/([^/]+)\/?$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function syncRoomUrl(slug: string) {
  const next = `/s/${encodeURIComponent(slug)}`
  if (window.location.pathname !== next) {
    window.history.replaceState({ slug }, '', next)
  }
}

export function navigateRoom(slug: string) {
  const next = `/s/${encodeURIComponent(slug)}`
  if (window.location.pathname !== next) {
    window.history.pushState({ slug }, '', next)
  }
}

export function roomShareUrl(slug: string): string {
  return `${window.location.origin}/s/${encodeURIComponent(slug)}`
}
