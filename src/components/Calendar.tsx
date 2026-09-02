import { useEffect, useMemo, useState } from 'react'
import { config } from '../config'
import { useHa } from '../ha/useHa'
import type { CalendarEvent } from '../ha/types'
import { Clock } from './Clock'
import { Icon } from './Icons'

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
const calColor = (entity: string) => config.calendars.find((c) => c.entity === entity)?.color ?? 'grey'
const entityIds = config.calendars.map((c) => c.entity)

/** Alle Tage (als Key), die ein Termin belegt – mehrtägige Termine erscheinen an jedem Tag. */
function eventDays(ev: CalendarEvent): string[] {
  const start = ev.allDay ? new Date(ev.start + 'T00:00:00') : new Date(ev.start)
  const end = ev.allDay ? new Date(ev.end + 'T00:00:00') : new Date(ev.end)
  const days: string[] = []
  const d = new Date(start); d.setHours(0, 0, 0, 0)
  const last = new Date(end); if (ev.allDay || end.getHours() + end.getMinutes() > 0) last.setSeconds(-1) // Ende ist exklusiv
  while (d <= last && days.length < 62) { days.push(dayKey(d)); d.setDate(d.getDate() + 1) }
  return days.length ? days : [dayKey(start)]
}

export function useCalendar(start: Date, end: Date) {
  const ha = useHa()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const s = start.getTime(), e = end.getTime()
  useEffect(() => {
    let alive = true
    const load = () => ha.getCalendarEvents(entityIds, new Date(s), new Date(e)).then((ev) => alive && setEvents(ev)).catch(console.error)
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => { alive = false; clearInterval(t) }
  }, [ha, s, e])
  return events
}

function useToday() {
  const [today, setToday] = useState(() => dayKey(new Date()))
  useEffect(() => { const t = setInterval(() => setToday(dayKey(new Date())), 60 * 1000); return () => clearInterval(t) }, [])
  return today
}

function EventRow({ ev, now }: { ev: CalendarEvent; now: Date }) {
  const past = !ev.allDay && new Date(ev.end) < now
  const running = !ev.allDay && new Date(ev.start) <= now && new Date(ev.end) >= now
  return (
    <div className={`event cal-${calColor(ev.calendar)} ${past ? 'past' : ''} ${running ? 'running' : ''}`}>
      <span className="event-dot" />
      <div className="event-time">{ev.allDay ? 'Ganztags' : `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`}</div>
      <div className="event-title">{ev.summary}</div>
    </div>
  )
}

/** Kompakte Liste für die Übersicht: die nächsten Termine (heute + morgen) */
export function Agenda({ limit = 4 }: { limit?: number }) {
  const [range] = useState(() => { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(a); b.setDate(b.getDate() + 2); return [a, b] })
  const events = useCalendar(range[0], range[1])
  const now = new Date()
  const today = dayKey(now)
  const upcoming = events.filter((e) => e.allDay || new Date(e.end) >= now).slice(0, limit)
  if (upcoming.length === 0) return <div className="card agenda"><div className="empty">Heute und morgen keine Termine</div></div>
  return (
    <div className="card agenda">
      {upcoming.map((ev, i) => (
        <div key={i} className="agenda-row">
          <span className="agenda-day">{eventDays(ev).includes(today) ? 'Heute' : 'Morgen'}</span>
          <EventRow ev={ev} now={now} />
        </div>
      ))}
    </div>
  )
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MAX_CHIPS = 4

/** Startbildschirm: Monatsraster mit allen Tagen, darunter die Termine des angetippten Tages. */
export function CalendarPage() {
  const today = useToday()
  const [monthOffset, setMonthOffset] = useState(0)
  const [selected, setSelected] = useState(today)
  const [lastToday, setLastToday] = useState(today)
  if (today !== lastToday) { setLastToday(today); setSelected(today); setMonthOffset(0) } // Tageswechsel über Nacht

  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() + 6) % 7)) // Montag vor dem 1.
  const cells = useMemo(() => {
    const rows = Math.ceil(((first.getDay() + 6) % 7 + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: rows * 7 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d })
  }, [first.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  const gridEnd = new Date(cells[cells.length - 1]); gridEnd.setDate(gridEnd.getDate() + 1)

  const events = useCalendar(gridStart, gridEnd)
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const ev of events) for (const k of eventDays(ev)) (m.get(k) ?? m.set(k, []).get(k)!).push(ev)
    return m
  }, [events])

  const selDate = new Date(selected + 'T00:00:00')
  const selList = byDay.get(selected) ?? []
  const selLabel = selected === today ? 'Heute' : selDate.toLocaleDateString('de-DE', { weekday: 'long' })

  return (
    <div className="page calendar-page">
      <header className="cal-head">
        <div className="cal-month">
          <button className="round" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Vormonat"><Icon.chevL size={28} /></button>
          <h1 onClick={() => { setMonthOffset(0); setSelected(today) }}>{first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h1>
          <button className="round" onClick={() => setMonthOffset(monthOffset + 1)} aria-label="Folgemonat"><Icon.chevR size={28} /></button>
        </div>
        <Clock compact />
      </header>

      <div className="card month">
        <div className="month-weekdays">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="month-grid" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}>
          {cells.map((d) => {
            const k = dayKey(d)
            const list = byDay.get(k) ?? []
            const cls = ['day', d.getMonth() !== first.getMonth() ? 'other' : '', k === today ? 'today' : '', k === selected ? 'selected' : '', d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : ''].join(' ')
            return (
              <button key={k} className={cls} onClick={() => setSelected(k)}>
                <span className="day-num">{d.getDate()}</span>
                <span className="chips">
                  {list.slice(0, MAX_CHIPS).map((ev, i) => (
                    <span key={i} className={`chip cal-${calColor(ev.calendar)} ${ev.allDay ? 'allday' : ''}`}>{ev.summary}</span>
                  ))}
                  {list.length > MAX_CHIPS && <span className="chip more">+{list.length - MAX_CHIPS}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <section className="day-detail">
        <h3>{selLabel} · {selDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}</h3>
        <div className="card day-events">
          {selList.length === 0 && <div className="empty">Keine Termine</div>}
          {selList.map((ev, i) => <EventRow key={i} ev={ev} now={now} />)}
        </div>
      </section>

      {config.calendars.length > 1 && (
        <div className="legend">
          {config.calendars.map((c) => <span key={c.entity} className={`cal-${c.color}`}><span className="event-dot" />{c.name}</span>)}
        </div>
      )}
    </div>
  )
}
