import type { Env } from '../types'
import { error, json, loadState } from '../lib/state'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const sprintId = url.searchParams.get('sprintId')
    const state = await loadState(context.env, sprintId)
    return json(state)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Failed to load state', 500)
  }
}
