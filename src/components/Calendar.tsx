import { useEffect, useMemo, useState } from 'react'
import { config } from '../config'
import { useHa } from '../ha/useHa'
import type { CalendarEvent } from '../ha/types'
import { Clock } from './Clock'
import { Icon } from './Icons'
import { AddEventSheet } from './AddEvent'

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
const calColor = (entity: string) => config.calendars.find((c) => c.entity === entity)?.color ?? 'grey'
const entityIds = config.calendars.map((c) => c.entity)

/** Wird nach dem Anlegen eines Termins gefeuert, damit alle Ansichten neu laden. */
export const calendarBus = new EventTarget()

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
    calendarBus.addEventListener('changed', load)
    return () => { alive = false; clearInterval(t); calendarBus.removeEventListener('changed', load) }
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

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Monatszustand: Raster-Tage + Termine pro Tag */
function useMonth(monthOffset: number) {
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
  return { first, cells, byDay }
}

function MonthGrid({ cells, first, byDay, today, selected, onSelect, compact }: {
  cells: Date[]; first: Date; byDay: Map<string, CalendarEvent[]>; today: string; selected: string; onSelect: (k: string) => void; compact?: boolean
}) {
  const maxChips = compact ? 3 : 4
  return (
    <>
      <div className="month-weekdays">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
      <div className={`month-grid ${compact ? 'compact' : ''}`} style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}>
        {cells.map((d) => {
          const k = dayKey(d)
          const list = byDay.get(k) ?? []
          const cls = ['day', d.getMonth() !== first.getMonth() ? 'other' : '', k === today ? 'today' : '', k === selected ? 'selected' : '', d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : ''].join(' ')
          return (
            <button key={k} className={cls} onClick={() => onSelect(k)}>
              <span className="day-num">{d.getDate()}</span>
              <span className="chips">
                {list.slice(0, maxChips).map((ev, i) => <span key={i} className={`chip cal-${calColor(ev.calendar)}`}>{ev.summary}</span>)}
                {list.length > maxChips && <span className="chip more">+{list.length - maxChips}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

const dayLabel = (k: string, today: string) => {
  const d = new Date(k + 'T00:00:00')
  return `${k === today ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'long' })} · ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
}

/** Termine eines Tages als Sheet – erscheint, wenn im Widget ein Tag angetippt wird. */
function DaySheet({ day, today, events, onClose, onOpen }: { day: string; today: string; events: CalendarEvent[]; onClose: () => void; onOpen: () => void }) {
  const [adding, setAdding] = useState(false)
  const now = new Date()
  if (adding) return <AddEventSheet day={day} onClose={() => { setAdding(false); onClose() }} />
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet day-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{dayLabel(day, today)}</h2>
          <button className="round" onClick={onClose} aria-label="Schließen"><Icon.close size={26} /></button>
        </div>
        <div className="day-sheet-list">
          {events.length === 0 && <div className="empty">Keine Termine</div>}
          {events.map((ev, i) => <EventRow key={i} ev={ev} now={now} />)}
        </div>
        <div className="sheet-options">
          <button className="pill on" onClick={() => setAdding(true)}>+ Termin eintragen</button>
          <button className="pill" onClick={() => { onClose(); onOpen() }}>Kalender öffnen</button>
        </div>
      </div>
    </div>
  )
}

/** Kompakter Monatskalender für die Übersicht – Termine stehen als Chips unter der Tageszahl, Tag antippen öffnet die Details, Monatsname öffnet die Kalender-Seite. */
export function CalendarWidget({ onOpen }: { onOpen: () => void }) {
  const today = useToday()
  const [selected, setSelected] = useState<string | null>(null)
  const { first, cells, byDay } = useMonth(0)

  return (
    <div className="card cal-widget">
      <button className="cal-widget-head" onClick={onOpen}>
        <span className="cal-widget-month">{first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
        <Icon.chevR size={24} />
      </button>
      <MonthGrid cells={cells} first={first} byDay={byDay} today={today} selected={selected ?? ''} onSelect={setSelected} compact />
      {selected && <DaySheet day={selected} today={today} events={byDay.get(selected) ?? []} onClose={() => setSelected(null)} onOpen={onOpen} />}
    </div>
  )
}

/** Kalender-Seite: großes Monatsraster, Monate blättern, Termine des Tages, Plus zum Eintragen. */
export function CalendarPage({ onBack }: { onBack: () => void }) {
  const today = useToday()
  const [monthOffset, setMonthOffset] = useState(0)
  const [selected, setSelected] = useState(today)
  const [adding, setAdding] = useState(false)
  const { first, cells, byDay } = useMonth(monthOffset)
  const now = new Date()
  const selList = byDay.get(selected) ?? []

  return (
    <div className="page calendar-page">
      <header className="cal-head">
        <button className="back" onClick={onBack}><Icon.home size={26} /><span>Übersicht</span></button>
        <div className="cal-month">
          <button className="round" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Vormonat"><Icon.chevL size={28} /></button>
          <h1 onClick={() => { setMonthOffset(0); setSelected(today) }}>{first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h1>
          <button className="round" onClick={() => setMonthOffset(monthOffset + 1)} aria-label="Folgemonat"><Icon.chevR size={28} /></button>
        </div>
        <Clock compact />
      </header>

      <div className="card month">
        <MonthGrid cells={cells} first={first} byDay={byDay} today={today} selected={selected} onSelect={setSelected} />
      </div>

      <section className="day-detail">
        <div className="day-detail-head">
          <h3>{dayLabel(selected, today)}</h3>
          <button className="round primary" onClick={() => setAdding(true)} aria-label="Termin eintragen"><Icon.plus size={28} /></button>
        </div>
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

      {adding && <AddEventSheet day={selected} onClose={() => setAdding(false)} />}
    </div>
  )
}
