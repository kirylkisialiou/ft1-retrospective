import type { Env } from '../types'
import {
  error,
  getActiveSprint,
  json,
  loadState,
  resolveSprint,
  SEAT_COUNT,
  SprintNotFoundError,
} from '../lib/state'

function catchSeat(e: unknown): Response {
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
  return error(e instanceof Error ? e.message : 'Seat error', 500)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      seatIndex?: number
      displayName?: string
      token?: string
      slug?: string
      sprintId?: string
    }

    const token = (body.token ?? '').trim()
    const displayName = (body.displayName ?? '').trim()
    if (!token) return error('Нужен token браузера')
    if (!displayName) return error('Как тебя зовут у костра?')
    if (displayName.length > 40) return error('Имя слишком длинное')

    const sprint = body.slug || body.sprintId
      ? await resolveSprint(context.env, {
          slug: body.slug,
          sprintId: body.sprintId,
        })
      : await getActiveSprint(context.env)

    if (sprint.status !== 'active') {
      return error('В архиве места уже заняты историей — только просмотр', 403)
    }

    let seatIndex = body.seatIndex
    if (typeof seatIndex !== 'number' || !Number.isInteger(seatIndex)) {
      return error('Выбери место 0–7')
    }
    if (seatIndex < 0 || seatIndex >= SEAT_COUNT) {
      return error('За столом только 8 мест')
    }

    // One seat per browser token in this room.
    await context.env.DB.prepare(
      `DELETE FROM seats WHERE sprint_id = ? AND occupant_token = ?`,
    )
      .bind(sprint.id, token)
      .run()

    const taken = await context.env.DB.prepare(
      `SELECT occupant_token FROM seats WHERE sprint_id = ? AND seat_index = ?`,
    )
      .bind(sprint.id, seatIndex)
      .first<{ occupant_token: string }>()

    if (taken && taken.occupant_token !== token) {
      return error('Это место уже занято', 409)
    }

    await context.env.DB.prepare(
      `INSERT INTO seats (sprint_id, seat_index, occupant_token, display_name)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sprint_id, seat_index) DO UPDATE SET
         occupant_token = excluded.occupant_token,
         display_name = excluded.display_name,
         claimed_at = datetime('now')`,
    )
      .bind(sprint.id, seatIndex, token, displayName)
      .run()

    return json(
      await loadState(context.env, {
        sprintId: sprint.id,
        token,
      }),
    )
  } catch (e) {
    return catchSeat(e)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const token = (url.searchParams.get('token') ?? '').trim()
    const slug = url.searchParams.get('slug')
    const sprintId = url.searchParams.get('sprintId')
    if (!token) return error('Нужен token')

    const sprint =
      slug || sprintId
        ? await resolveSprint(context.env, { slug, sprintId })
        : await getActiveSprint(context.env)

    if (sprint.status !== 'active') {
      return error('В архиве нельзя вставать — это уже история', 403)
    }

    await context.env.DB.prepare(
      `DELETE FROM seats WHERE sprint_id = ? AND occupant_token = ?`,
    )
      .bind(sprint.id, token)
      .run()

    return json(
      await loadState(context.env, {
        sprintId: sprint.id,
        token,
      }),
    )
  } catch (e) {
    return catchSeat(e)
  }
}
