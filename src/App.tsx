import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import './App.css'
import { CampScene } from './components/CampScene'
import { canDeal, COLUMN_TARGET } from './lib/deal'
import { api, type StorageMode } from './lib/api'
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
      <div className="moon" />
    </div>
  )
}

function formatDealCopy(state: RetroState): string {
  const lines = [
    `${APP_NAME} · Sprint #${state.sprint.number}`,
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
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: 'plus' as Category,
    title: '',
    body: '',
    author: '',
  })

  async function load(sprintId?: string | null) {
    const result = await api.getState(sprintId)
    setState(result.data)
    setMode(result.mode)
    setViewingId(result.data.readOnly ? result.data.sprint.id : null)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load(null)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить')
          setMode('local')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mode !== 'remote' || viewingId) return
    const id = window.setInterval(() => {
      void load(null).catch(() => undefined)
    }, 8000)
    return () => window.clearInterval(id)
  }, [mode, viewingId])

  const readOnly = state?.readOnly ?? false
  const dealAvailable = !readOnly && canDeal(state?.cards ?? [])
  const thinColumns = CATEGORIES.filter((cat) => {
    const human = (state?.cards ?? []).filter(
      (c) => c.source === 'human' && c.category === cat.id,
    ).length
    return human < COLUMN_TARGET
  }).length
  const archived = state?.history.filter((s) => s.status === 'archived') ?? []

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || readOnly) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.addCard(form)
      setState(result.data)
      setMode(result.mode)
      setViewingId(null)
      setForm((f) => ({ ...f, title: '', body: '' }))
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
      const result = await api.dealFromCampfire()
      setState(result.data)
      setMode(result.mode)
      setViewingId(null)
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
      const result = await api.deleteCard(id)
      setState(result.data)
      setMode(result.mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
    } finally {
      setBusy(false)
    }
  }

  async function onSprintNumber(value: number) {
    if (readOnly || !Number.isFinite(value) || value < 1) return
    try {
      const result = await api.updateSprint({ number: value })
      setState(result.data)
      setMode(result.mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить номер')
    }
  }

  async function onCloseSprint() {
    if (readOnly) return
    const ok = window.confirm(
      `Закрыть Sprint #${state?.sprint.number} и открыть следующий?\nКарты текущего спринта останутся в истории.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.closeSprint()
      setState(result.data)
      setMode(result.mode)
      setViewingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось закрыть спринт')
    } finally {
      setBusy(false)
    }
  }

  async function onOpenSprint(id: string | null) {
    setBusy(true)
    setError(null)
    try {
      await load(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть спринт')
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

  function cardsFor(category: Category): RetroCard[] {
    return state?.cards.filter((c) => c.category === category) ?? []
  }

  return (
    <div className="app">
      <Stars />
      <div className="horizon" aria-hidden="true">
        <div className="silhouette" />
      </div>
      <div className="campfire-glow" aria-hidden="true" />
      <div className="side-fire-wash" aria-hidden="true" />

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
          <span className="mode-pill">
            {mode === 'loading'
              ? '…'
              : mode === 'remote'
                ? 'Cloudflare D1'
                : 'localStorage'}
          </span>
        </div>
      </header>

      {readOnly ? (
        <div className="archive-banner">
          Архив · Sprint #{state?.sprint.number} — только просмотр
        </div>
      ) : null}

      <div className="layout">
        <aside className="sidebar">
          <CampScene />

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
                    value={form.author}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, author: e.target.value }))
                    }
                    placeholder="Имя"
                    maxLength={40}
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
                const activeView =
                  item.id === state?.sprint.id ||
                  (item.status === 'active' && !readOnly && !viewingId)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`history-item${activeView ? ' current' : ''}`}
                      onClick={() =>
                        void onOpenSprint(
                          item.status === 'active' ? null : item.id,
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
                        ? 'Доложить темы в тонкие колонки (свои карты остаются)'
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

            {!readOnly && dealAvailable ? (
              <div className="low-cards">
                Тонких колонок: {thinColumns}. «Раздать» доложит до{' '}
                {COLUMN_TARGET} тем в каждую (старые карты колоды заменятся).
              </div>
            ) : null}

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
          </section>
        </main>
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

      {error ? <p className="status error">{error}</p> : null}
      {!state && !error ? <p className="status">Загрузка…</p> : null}
    </div>
  )
}
