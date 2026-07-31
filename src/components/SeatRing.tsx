import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Seat } from '../types'
import { SEAT_COUNT } from '../types'

interface Props {
  seats: Seat[]
  readOnly: boolean
  busy: boolean
  defaultName: string
  side: 'left' | 'right'
  onClaim: (seatIndex: number, displayName: string) => void
  onLeave: () => void
}

/** Left column = seats 0–3, right = 4–7. */
export function SeatColumn({
  seats,
  readOnly,
  busy,
  defaultName,
  side,
  onClaim,
  onLeave,
}: Props) {
  const [name, setName] = useState(defaultName)
  const [picking, setPicking] = useState<number | null>(null)
  const start = side === 'left' ? 0 : 4
  const indices = [start, start + 1, start + 2, start + 3]

  useEffect(() => {
    setName(defaultName)
  }, [defaultName])

  function tryClaim(seatIndex: number) {
    if (readOnly || busy) return
    const seat = seats[seatIndex]
    if (seat?.occupied && !seat.isMine) return
    if (seat?.isMine) {
      onLeave()
      return
    }
    setPicking(seatIndex)
  }

  function confirmClaim() {
    if (picking === null) return
    const trimmed = name.trim()
    if (!trimmed) return
    onClaim(picking, trimmed)
    setPicking(null)
  }

  const modal =
    picking !== null && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="seat-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Сесть за стол"
          >
            <div className="seat-modal-card">
              <h3>Место {picking + 1}</h3>
              <label>
                Как тебя звать
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Имя"
                  maxLength={40}
                  autoFocus
                />
              </label>
              <div className="seat-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPicking(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!name.trim() || busy}
                  onClick={confirmClaim}
                >
                  Сесть
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={`seat-column seat-column-${side}`}>
      {indices.map((i) => {
        const seat = seats[i] ?? {
          seatIndex: i,
          displayName: '',
          occupied: false,
          isMine: false,
        }
        return (
          <button
            key={i}
            type="button"
            className={`seat${seat.occupied ? ' occupied' : ' free'}${seat.isMine ? ' mine' : ''}`}
            disabled={readOnly || busy || (seat.occupied && !seat.isMine)}
            onClick={() => tryClaim(i)}
            title={
              seat.isMine
                ? 'Встать из‑за стола'
                : seat.occupied
                  ? seat.displayName
                  : 'Сесть здесь'
            }
          >
            <span className="seat-chip">Место {i + 1}</span>
            <span className="seat-name">
              {seat.occupied ? seat.displayName : 'Свободно'}
            </span>
          </button>
        )
      })}
      {side === 'left' ? (
        <p className="seat-column-note">
          {seats.filter((s) => s.occupied).length}/{SEAT_COUNT} за столом
        </p>
      ) : null}
      {modal}
    </div>
  )
}
