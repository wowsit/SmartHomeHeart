import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHa } from '../ha/useHa'
import type { CalendarEvent } from '../ha/types'

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const evDay = (ev: CalendarEvent) => (ev.allDay ? ev.start.slice(0, 10) : dayKey(new Date(ev.start)))
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export function useCalendar(days: number) {
  const ha = useHa()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + days)
      ha.getCalendarEvents(config.calendars, start, end).then((e) => alive && setEvents(e)).catch(console.error)
    }
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => { alive = false; clearInterval(t) }
  }, [ha, days])
  return events
}

function EventRow({ ev, now }: { ev: CalendarEvent; now: Date }) {
  const past = !ev.allDay && new Date(ev.end) < now
  const running = !ev.allDay && new Date(ev.start) <= now && new Date(ev.end) >= now
  return (
    <div className={`event ${past ? 'past' : ''} ${running ? 'running' : ''} cal-${config.calendars.indexOf(ev.calendar)}`}>
      <div className="event-time">{ev.allDay ? 'Ganztags' : fmtTime(ev.start)}</div>
      <div className="event-title">{ev.summary}</div>
    </div>
  )
}

/** Kompakte Liste: die nächsten Termine (heute + morgen), vergangene ausgeblendet */
export function Agenda({ limit = 4 }: { limit?: number }) {
  const events = useCalendar(2)
  const now = new Date()
  const today = dayKey(now)
  const upcoming = events.filter((e) => e.allDay || new Date(e.end) >= now).slice(0, limit)
  if (upcoming.length === 0) return <div className="card agenda"><div className="empty">Heute und morgen keine Termine</div></div>
  return (
    <div className="card agenda">
      {upcoming.map((ev, i) => (
        <div key={i} className="agenda-row">
          <span className="agenda-day">{evDay(ev) === today ? 'Heute' : 'Morgen'}</span>
          <EventRow ev={ev} now={now} />
        </div>
      ))}
    </div>
  )
}

export function CalendarPage() {
  const events = useCalendar(7)
  const now = new Date()
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0); return d })
  return (
    <div className={`page calendar-page ${config.orientation === 'portrait' ? 'portrait' : ''}`}>
      {days.map((d, i) => {
        const key = dayKey(d)
        const list = events.filter((e) => evDay(e) === key)
        return (
          <div key={key} className={`card day-col ${i === 0 ? 'today' : ''}`}>
            <div className="day-head">
              <div className="day-name">{i === 0 ? 'Heute' : i === 1 ? 'Morgen' : d.toLocaleDateString('de-DE', { weekday: 'long' })}</div>
              <div className="muted">{d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</div>
            </div>
            <div className="day-events">
              {list.length === 0 && <div className="empty">Frei</div>}
              {list.map((ev, j) => <EventRow key={j} ev={ev} now={now} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
