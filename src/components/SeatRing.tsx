import { useState } from 'react'
import type { Seat } from '../types'
import { SEAT_COUNT } from '../types'

/** Positions around the oval poker table (percent). */
const SEAT_POS: { left: string; top: string }[] = [
  { left: '12%', top: '8%' },
  { left: '38%', top: '2%' },
  { left: '62%', top: '2%' },
  { left: '88%', top: '8%' },
  { left: '90%', top: '78%' },
  { left: '62%', top: '88%' },
  { left: '38%', top: '88%' },
  { left: '10%', top: '78%' },
]

interface Props {
  seats: Seat[]
  readOnly: boolean
  busy: boolean
  defaultName: string
  onClaim: (seatIndex: number, displayName: string) => void
  onLeave: () => void
}

export function SeatRing({
  seats,
  readOnly,
  busy,
  defaultName,
  onClaim,
  onLeave,
}: Props) {
  const [name, setName] = useState(defaultName)
  const [picking, setPicking] = useState<number | null>(null)
  const mine = seats.find((s) => s.isMine)
  const taken = seats.filter((s) => s.occupied).length

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

  return (
    <div className="seat-ring">
      {Array.from({ length: SEAT_COUNT }, (_, i) => {
        const seat = seats[i] ?? {
          seatIndex: i,
          displayName: '',
          occupied: false,
          isMine: false,
        }
        const pos = SEAT_POS[i]
        return (
          <button
            key={i}
            type="button"
            className={`seat${seat.occupied ? ' occupied' : ' free'}${seat.isMine ? ' mine' : ''}`}
            style={{ left: pos.left, top: pos.top }}
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
            <span className="seat-chip">{i + 1}</span>
            <span className="seat-name">
              {seat.occupied ? seat.displayName : 'Свободно'}
            </span>
          </button>
        )
      })}

      <div className="seat-legend">
        За столом {taken}/{SEAT_COUNT}
        {mine ? ` · ты: ${mine.displayName}` : ''}
        {readOnly ? ' · архив' : ''}
      </div>

      {picking !== null ? (
        <div className="seat-modal" role="dialog" aria-label="Сесть за стол">
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
        </div>
      ) : null}
    </div>
  )
}
