import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import './App.css'
import { SeatColumn } from './components/SeatRing'
import { canDeal, COLUMN_TARGET } from './lib/deal'
import {
  api,
  getLastRemoteError,
  isSprintNotFound,
  sprintNotFoundPayload,
  type SprintNotFoundPayload,
  type StorageMode,
} from './lib/api'
import {
  getSavedDisplayName,
  saveDisplayName,
} from './lib/occupant'
import {
  navigateRoom,
  parseRoomSlug,
  roomShareUrl,
  syncRoomUrl,
} from './lib/route'
import {
  nextBackoff,
  POLL_ACTIVE_MS,
  POLL_ARCHIVED_MS,
  stateFingerprint,
} from './lib/sync'
import {
  APP_NAME,
  CATEGORIES,
  type Category,
  type RetroCard,
  type RetroState,
} from './types'

function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: `${(i * 41 + 7) % 100}%`,
        top: `${(i * 29) % 72}%`,
        delay: `${(i % 12) * 0.28}s`,
        dur: `${2.2 + (i % 6) * 0.55}s`,
        bright: i % 5 === 0,
      })),
    [],
  )

  return (
    <div className="sky" aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className={`star${s.bright ? ' bright' : ''}`}
          style={
            {
              left: s.left,
              top: s.top,
              '--delay': s.delay,
              '--dur': s.dur,
            } as CSSProperties
          }
        />
      ))}
      <div className="moon" aria-hidden="true">
        <img className="moon-img" src="/moon-v3.png" alt="" />
      </div>
    </div>
  )
}

function formatDealCopy(state: RetroState): string {
  const lines = [
    `${APP_NAME} · Sprint #${state.sprint.number}`,
    roomShareUrl(state.sprint.slug),
    '',
    ...CATEGORIES.flatMap((cat) => {
      const cards = state.cards.filter((c) => c.category === cat.id)
      if (!cards.length) return []
      return [
        `## ${cat.label}`,
        ...cards.map(
          (c) =>
            `- ${c.title}${c.body ? `: ${c.body}` : ''} (${c.author})`,
        ),
        '',
      ]
    }),
  ]
  return lines.filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim()
}

export default function App() {
  const [state, setState] = useState<RetroState | null>(null)
  const [mode, setMode] = useState<StorageMode>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [liveHint, setLiveHint] = useState('')
  const [roomRef, setRoomRef] = useState<string | null>(() => parseRoomSlug())
  const [missingRoom, setMissingRoom] = useState<SprintNotFoundPayload | null>(
    null,
  )
  const [form, setForm] = useState({
    category: 'plus' as Category,
    title: '',
    body: '',
    author: getSavedDisplayName(),
  })

  const fingerprintRef = useRef('')
  const roomRefStable = useRef(roomRef)
  roomRefStable.current = roomRef
  const readOnlyRef = useRef(false)

  const applyBoard = useCallback(
    (
      result: { data: RetroState; mode: 'remote' | 'local' },
      opts?: { syncUrl?: boolean; force?: boolean },
    ) => {
      const fp = stateFingerprint(result.data)
      if (!opts?.force && fp === fingerprintRef.current) {
        setMode(result.mode)
        return
      }
      fingerprintRef.current = fp
      setState(result.data)
      setMode(result.mode)
      setRoomRef(result.data.sprint.slug)
      readOnlyRef.current = result.data.readOnly
      if (opts?.syncUrl !== false) syncRoomUrl(result.data.sprint.slug)

      const mine = result.data.seats.find((s) => s.isMine)
      if (mine) {
        setForm((f) =>
          f.author === mine.displayName ? f : { ...f, author: mine.displayName },
        )
      }
    },
    [],
  )

  const load = useCallback(
    async (ref?: string | null, syncUrl = true) => {
      try {
        const result = await api.getState(ref)
        setMissingRoom(null)
        applyBoard(result, { syncUrl, force: true })
        return result
      } catch (e) {
        if (!isSprintNotFound(e)) throw e
        const payload = sprintNotFoundPayload(e)
        if (payload) setMissingRoom(payload)
        // Show active board under the warning; keep the typed URL as-is.
        const active = await api.getState(null)
        applyBoard(active, { syncUrl: false, force: true })
        return active
      }
    },
    [applyBoard],
  )

  const refreshSoft = useCallback(async () => {
    const ref = roomRefStable.current
    try {
      const result = await api.getState(ref, { soft: true })
      applyBoard(result, { syncUrl: false })
      setLiveHint(result.mode === 'remote' ? 'live' : 'local')
      setError(null)
      return true
    } catch (e) {
      if (isSprintNotFound(e)) {
        // Polling uses loaded room slug; ignore stale URL mismatches.
        return true
      }
      setLiveHint('reconnect…')
      return false
    }
  }, [applyBoard])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load(parseRoomSlug())
        if (!cancelled) setLiveHint('live')
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить')
          setMode('local')
          setLiveHint('local')
        }
      }
    })()

    function onPop() {
      void load(parseRoomSlug()).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Не удалось открыть комнату')
      })
    }
    window.addEventListener('popstate', onPop)
    return () => {
      cancelled = true
      window.removeEventListener('popstate', onPop)
    }
  }, [load])

  // Near-live sync: poll while tab visible; pause when hidden; backoff on errors.
  useEffect(() => {
    let timer: number | null = null
    let stopped = false
    let delay = POLL_ACTIVE_MS

    async function tick() {
      if (stopped) return
      if (document.hidden) {
        timer = window.setTimeout(tick, delay)
        return
      }
      const ok = await refreshSoft()
      delay = ok
        ? readOnlyRef.current
          ? POLL_ARCHIVED_MS
          : POLL_ACTIVE_MS
        : nextBackoff(delay)
      if (!stopped) timer = window.setTimeout(tick, delay)
    }

    function onVisibility() {
      if (!document.hidden) {
        delay = POLL_ACTIVE_MS
        void refreshSoft()
      }
    }

    window.addEventListener('visibilitychange', onVisibility)
    timer = window.setTimeout(tick, POLL_ACTIVE_MS)
    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshSoft])

  // Same-browser tabs share local mutations instantly.
  useEffect(() => {
    const bc = new BroadcastChannel('ft1-retrospective-sync')
    bc.onmessage = (ev: MessageEvent<{ type?: string; ref?: string }>) => {
      if (ev.data?.type === 'mutate') void refreshSoft()
    }
    return () => bc.close()
  }, [refreshSoft])

  const readOnly = state?.readOnly ?? false
  readOnlyRef.current = readOnly
  const mySeat = state?.seats.find((s) => s.isMine)
  const dealAvailable = !readOnly && canDeal(state?.cards ?? [])
  const thinColumns = CATEGORIES.filter((cat) => {
    const human = (state?.cards ?? []).filter(
      (c) => c.source === 'human' && c.category === cat.id,
    ).length
    return human < COLUMN_TARGET
  }).length
  const archived = state?.history.filter((s) => s.status === 'archived') ?? []

  async function applyState(result: {
    data: RetroState
    mode: 'remote' | 'local'
  }) {
    applyBoard(result, { syncUrl: true, force: true })
    setLiveHint(result.mode === 'remote' ? 'live' : 'local')
    try {
      const bc = new BroadcastChannel('ft1-retrospective-sync')
      bc.postMessage({ type: 'mutate', ref: result.data.sprint.slug })
      bc.close()
    } catch {
      /* ignore */
    }
    if (result.mode === 'remote') {
      api.markRemoteOk()
      void refreshSoft()
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || readOnly) return
    const author = (mySeat?.displayName || form.author).trim() || 'Странник'
    setBusy(true)
    setError(null)
    try {
      const result = await api.addCard({ ...form, author })
      await applyState(result)
      setForm((f) => ({ ...f, title: '', body: '', author }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить карту')
    } finally {
      setBusy(false)
    }
  }

  async function onDeal() {
    if (readOnly || !dealAvailable) return
    setBusy(true)
    setError(null)
    try {
      await applyState(await api.dealFromCampfire())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Колода недоступна')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (readOnly) return
    setBusy(true)
    try {
      await applyState(await api.deleteCard(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    } finally {
      setBusy(false)
    }
  }

  async function onSprintNumber(value: number) {
    if (readOnly || !Number.isFinite(value) || value < 1) return
    try {
      // Number label only — room slug/URL stays stable (share links don't break).
      await applyState(await api.updateSprint({ number: value }))
      setMissingRoom(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить номер')
    }
  }

  async function onCloseSprint() {
    if (readOnly) return
    const ok = window.confirm(
      `Закрыть Sprint #${state?.sprint.number} и открыть следующий?\nСсылка на архив останется: /s/${state?.sprint.slug}`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.closeSprint()
      await applyState(result)
      navigateRoom(result.data.sprint.slug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось закрыть спринт')
    } finally {
      setBusy(false)
    }
  }

  async function onOpenSprint(slugOrId: string | null) {
    setBusy(true)
    setError(null)
    try {
      if (slugOrId) navigateRoom(slugOrId)
      else if (missingRoom?.activeSlug) navigateRoom(missingRoom.activeSlug)
      await load(slugOrId)
      setMissingRoom(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть спринт')
    } finally {
      setBusy(false)
    }
  }

  async function onClaimSeat(seatIndex: number, displayName: string) {
    setBusy(true)
    setError(null)
    try {
      saveDisplayName(displayName)
      const result = await api.claimSeat({
        seatIndex,
        displayName,
        ref: roomRef,
      })
      await applyState(result)
      setForm((f) => ({ ...f, author: displayName }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сесть')
    } finally {
      setBusy(false)
    }
  }

  async function onLeaveSeat() {
    setBusy(true)
    setError(null)
    try {
      await applyState(await api.leaveSeat(roomRef))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось встать')
    } finally {
      setBusy(false)
    }
  }

  async function onCopy() {
    if (!state) return
    try {
      await navigator.clipboard.writeText(formatDealCopy(state))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Не удалось скопировать')
    }
  }

  async function onCopyLink() {
    if (!state) return
    try {
      await navigator.clipboard.writeText(roomShareUrl(state.sprint.slug))
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setError('Не удалось скопировать ссылку')
    }
  }

  function cardsFor(category: Category): RetroCard[] {
    return state?.cards.filter((c) => c.category === category) ?? []
  }

  const offline =
    mode === 'local' || liveHint === 'reconnect…' || liveHint === 'local'

  return (
    <div className="app">
      <div className="bg-camp" aria-hidden="true" />
      <Stars />
      <div className="campfire-glow" aria-hidden="true" />

      <header className="hero">
        <div className="badge">Sprint #{state?.sprint.number ?? '…'}</div>
        <h1>{APP_NAME}</h1>
        <p className="lede">Вечер у костра после спринта.</p>
        <div className="sprint-row">
          {!readOnly ? (
            <label>
              Спринт #
              <input
                type="number"
                min={1}
                value={state?.sprint.number ?? 1}
                onChange={(e) => void onSprintNumber(Number(e.target.value))}
              />
            </label>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void onOpenSprint(null)}
            >
              К текущему спринту
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void onCopyLink()}
            disabled={!state}
          >
            {linkCopied ? 'Ссылка скопирована' : 'Ссылка на комнату'}
          </button>
          <span className={`mode-pill${offline ? ' warn' : ''}`}>
            {mode === 'loading'
              ? '…'
              : mode === 'remote'
                ? `D1 · ${liveHint || 'live'}`
                : 'localStorage · нет sync'}
          </span>
        </div>
        {state ? (
          <p className="room-url">
            Комната: /s/{state.sprint.slug}
            {!readOnly ? (
              <span className="room-url-hint">
                {' '}
                · номер в поле выше — ярлык; ссылка меняется только при «Закрыть
                спринт»
              </span>
            ) : null}
          </p>
        ) : null}
      </header>

      {missingRoom ? (
        <div className="missing-banner" role="alert">
          <p>
            Комната <code>/s/{missingRoom.requested}</code> не найдена.
            Менять URL вручную на <code>/s/s-25</code> не создаёт спринт — он
            появляется после «Закрыть спринт» (или если такой slug уже есть в
            истории).
          </p>
          <p className="missing-list">
            Есть в базе:{' '}
            {missingRoom.sprints.length
              ? missingRoom.sprints
                  .map(
                    (s) =>
                      `/s/${s.slug} (#${s.number}${s.status === 'active' ? ', текущий' : ''})`,
                  )
                  .join(' · ')
              : 'пока только текущий спринт'}
          </p>
          <div className="missing-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onOpenSprint(missingRoom.activeSlug)}
            >
              Открыть текущий /s/{missingRoom.activeSlug}
            </button>
          </div>
        </div>
      ) : null}

      {offline ? (
        <div className="offline-banner" role="status">
          Офлайн / localStorage — другие браузеры вас не видят.
          {getLastRemoteError() ? ` (${getLastRemoteError()})` : ''} Проверьте
          Pages → Bindings → D1 <code>DB</code> → ft1-retro.
        </div>
      ) : null}

      {readOnly ? (
        <div className="archive-banner">
          Архив · Sprint #{state?.sprint.number} — только просмотр
        </div>
      ) : null}

      <div className="layout">
        <aside className="sidebar">
          {!readOnly ? (
            <section className="panel">
              <h2>Новая карта</h2>
              <form className="form" onSubmit={onAdd}>
                <label>
                  Колонка
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        category: e.target.value as Category,
                      }))
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.suit} {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Заголовок
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Что обсуждаем"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Текст
                  <textarea
                    value={form.body}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, body: e.target.value }))
                    }
                    placeholder="Коротко"
                    maxLength={600}
                  />
                </label>
                <label>
                  Автор
                  <input
                    value={mySeat?.displayName || form.author}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, author: e.target.value }))
                    }
                    placeholder="Имя"
                    maxLength={40}
                    disabled={Boolean(mySeat)}
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  Добавить
                </button>
              </form>
            </section>
          ) : null}

          <section className="panel history-panel">
            <h2>История</h2>
            {!readOnly ? (
              <button
                type="button"
                className="btn btn-ghost close-sprint"
                onClick={() => void onCloseSprint()}
                disabled={busy}
              >
                Закрыть спринт
              </button>
            ) : null}
            <ul className="history-list">
              {(state?.history ?? []).map((item) => {
                const activeView = item.slug === state?.sprint.slug
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`history-item${activeView ? ' current' : ''}`}
                      onClick={() =>
                        void onOpenSprint(
                          item.status === 'active' && !readOnly
                            ? item.slug
                            : item.slug,
                        )
                      }
                      disabled={busy}
                    >
                      <span className="history-num">#{item.number}</span>
                      <span className="history-meta">
                        {item.status === 'active' ? 'текущий' : 'архив'} ·{' '}
                        {item.cardCount} карт
                      </span>
                    </button>
                  </li>
                )
              })}
              {archived.length === 0 && (state?.history.length ?? 0) <= 1 ? (
                <li className="history-empty">Пока только текущий спринт</li>
              ) : null}
            </ul>
          </section>
        </aside>

        <main className="table-wrap">
          <section className="poker-table">
            <div className="table-top">
              <div className="crew">
                <strong>Sprint #{state?.sprint.number ?? '…'}</strong>
              </div>
              <div className="table-actions">
                {!readOnly ? (
                  <button
                    type="button"
                    className={`deal-btn${busy ? ' busy' : ''}`}
                    onClick={() => void onDeal()}
                    disabled={busy || !dealAvailable}
                    title={
                      dealAvailable
                        ? `Тонких колонок: ${thinColumns}. Доложит до ${COLUMN_TARGET} тем в каждую (колода заменится).`
                        : 'Во всех колонках уже хватает своих карт'
                    }
                  >
                    Раздать
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void onCopy()}
                  disabled={!state}
                >
                  {copied ? 'Скопировано' : 'Скопировать'}
                </button>
              </div>
            </div>

            <div className="table-board">
              <SeatColumn
                side="left"
                seats={state?.seats ?? []}
                readOnly={readOnly}
                busy={busy}
                defaultName={form.author || getSavedDisplayName()}
                onClaim={(idx, name) => void onClaimSeat(idx, name)}
                onLeave={() => void onLeaveSeat()}
              />

              <div className="columns">
                {CATEGORIES.map((cat) => {
                  const list = cardsFor(cat.id)
                  const suitClass =
                    cat.id === 'plus' || cat.id === 'thanks' ? 'red' : 'black'
                  return (
                    <div className="column" key={cat.id}>
                      <div className="column-head">
                        <h3>{cat.label}</h3>
                        <span className={`suit ${suitClass}`}>{cat.suit}</span>
                      </div>
                      <div className="cards">
                        {list.length === 0 ? (
                          <div className="empty-col">Пусто</div>
                        ) : (
                          list.map((card) => (
                            <article
                              key={card.id}
                              className={`card${card.source === 'camp' ? ' camp' : ''}`}
                            >
                              <div className="card-top">
                                <span>
                                  {card.source === 'camp' ? 'Колода' : 'Команда'}
                                </span>
                                <span>{cat.suit}</span>
                              </div>
                              <h4>{card.title}</h4>
                              {card.body ? <p>{card.body}</p> : null}
                              <div className="card-foot">
                                <span>{card.author}</span>
                                {!readOnly ? (
                                  <button
                                    type="button"
                                    className="linkish"
                                    onClick={() => void onDelete(card.id)}
                                    disabled={busy}
                                  >
                                    убрать
                                  </button>
                                ) : null}
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <SeatColumn
                side="right"
                seats={state?.seats ?? []}
                readOnly={readOnly}
                busy={busy}
                defaultName={form.author || getSavedDisplayName()}
                onClaim={(idx, name) => void onClaimSeat(idx, name)}
                onLeave={() => void onLeaveSeat()}
              />
            </div>

            <footer className="retro-rules">
              <h2>Правила у костра</h2>
              <ul>
                <li>Безопасное место — можно говорить прямо.</li>
                <li>Без обвинений: смотрим на процесс, не на людей.</li>
                <li>Один говорит — остальные слушают.</li>
                <li>Выходим с действиями, а не только с дымом.</li>
              </ul>
            </footer>
          </section>
        </main>
      </div>

      {error ? <p className="status error">{error}</p> : null}
      {!state && !error ? <p className="status">Загрузка…</p> : null}
    </div>
  )
}
