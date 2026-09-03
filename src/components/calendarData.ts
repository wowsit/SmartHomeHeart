import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHa } from '../ha/useHa'
import type { CalendarEvent } from '../ha/types'

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const entityIds = config.calendars.map((c) => c.entity)

/** Wird nach dem Anlegen eines Termins gefeuert, damit alle Ansichten neu laden. */
export const calendarBus = new EventTarget()

/** Lädt die Termine aller konfigurierten Kalender im Zeitraum, aktualisiert alle 5 min und bei `calendarBus` 'changed'. */
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
