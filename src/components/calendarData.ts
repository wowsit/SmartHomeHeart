import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHa } from '../ha/useHa'
import type { CalendarEvent } from '../ha/types'

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const entityIds = config.calendars.map((c) => c.entity)

/** Wird nach dem Anlegen eines Termins gefeuert, damit alle Ansichten neu laden. */
export const calendarBus = new EventTarget()

/** Lädt die Termine aller konfigurierten Kalender im Zeitraum. Live-Update: HA-Events (Kalender-Entity ändert sich, calendar.*-Service,
 *  Refresh-Automation nach iCloud-Abgleich), `calendarBus` 'changed', wenn der Tab wieder sichtbar wird – plus Fallback-Poll alle 60 s. */
export function useCalendar(start: Date, end: Date) {
  const ha = useHa()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const s = start.getTime(), e = end.getTime()
  useEffect(() => {
    let alive = true
    const load = () => ha.getCalendarEvents(entityIds, new Date(s), new Date(e)).then((ev) => alive && setEvents(ev)).catch(console.error)
    let timer: ReturnType<typeof setTimeout> | undefined
    // mehrere Events kurz hintereinander (z. B. state_changed + call_service) → nur ein Reload
    const reload = () => { clearTimeout(timer); timer = setTimeout(load, 300) }
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    load()
    const t = setInterval(load, 60 * 1000)
    const unsubHa = ha.subscribeCalendarChanges(reload)
    calendarBus.addEventListener('changed', reload)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false; clearInterval(t); clearTimeout(timer); unsubHa()
      calendarBus.removeEventListener('changed', reload); document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ha, s, e])
  return events
}
