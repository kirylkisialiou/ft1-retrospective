import type { Env } from '../types'
import { error, json, loadState, SprintNotFoundError } from '../lib/state'

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
    if (e instanceof SprintNotFoundError) {
      return json(
        {
          error: e.message,
          code: e.code,
          requested: e.requested,
          activeSlug: e.activeSlug,
          sprints: e.sprints,
        },
        404,
      )
    }
    return error(e instanceof Error ? e.message : 'Failed to load state', 500)
  }
}
