import type { Env } from '../types'
import { error, json, loadState } from '../lib/state'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const state = await loadState(context.env, {
      sprintId: url.searchParams.get('sprintId'),
      slug: url.searchParams.get('slug'),
      token: url.searchParams.get('token'),
    })
    return json(state)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Failed to load state', 500)
  }
}
