import { useNow } from '../hooks/useNow'

export function Clock({ big = false, compact = false }: { big?: boolean; compact?: boolean }) {
  const now = useNow()
  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  // Datum steht neben der Uhrzeit (nicht darunter) – Wunsch 2026-09-05
  return (
    <div className={`clock clock-inline ${big ? 'clock-big' : ''} ${compact ? 'clock-compact' : ''}`}>
      <div className="clock-time">{time}</div>
      <div className="clock-date">{date}</div>
    </div>
  )
}
