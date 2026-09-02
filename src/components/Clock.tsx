import { useEffect, useState } from 'react'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(t) }, [intervalMs])
  return now
}

export function Clock({ big = false }: { big?: boolean }) {
  const now = useNow()
  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className={`clock ${big ? 'clock-big' : ''}`}>
      <div className="clock-time">{time}</div>
      <div className="clock-date">{date}</div>
    </div>
  )
}
