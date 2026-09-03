import {
  createConnection, createLongLivedTokenAuth, subscribeEntities, callService as haCallService,
  type Connection, type HassEntities,
} from 'home-assistant-js-websocket'
import type { NewCalendarEvent, HaBackend, EntityMap, ConnState, ForecastDay, CalendarEvent, AssistLike, AssistState } from './types'
import { AssistClient } from './assist'
import { watchAssistRuns } from './assistRuns'
import { config } from '../config'

/** Echte Anbindung an Home Assistant per WebSocket (Live-Updates) + REST (Kalender). */
export class HaWsBackend implements HaBackend {
  private connPromise: Promise<Connection>
  private connState: ConnState = 'connecting'
  private connSubs = new Set<(s: ConnState) => void>()
  private entitySubs = new Set<(e: EntityMap) => void>()
  private latest: EntityMap = {}

  private url: string
  private token: string

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
    this.connPromise = this.connect()
  }

  private setConn(s: ConnState) { this.connState = s; this.connSubs.forEach((cb) => cb(s)) }

  private async connect(): Promise<Connection> {
    const auth = createLongLivedTokenAuth(this.url, this.token)
    // createConnection wirft bei Fehler; wir versuchen es mit Backoff erneut.
    for (let attempt = 0; ; attempt++) {
      try {
        const conn = await createConnection({ auth })
        this.setConn('connected')
        conn.addEventListener('disconnected', () => this.setConn('disconnected'))
        conn.addEventListener('ready', () => this.setConn('connected'))
        subscribeEntities(conn, (ents: HassEntities) => {
          this.latest = ents as unknown as EntityMap
          this.entitySubs.forEach((cb) => cb(this.latest))
        })
        return conn
      } catch (err) {
        console.error('HA connect failed', err)
        this.setConn('disconnected')
        await new Promise((r) => setTimeout(r, Math.min(30000, 2000 * 2 ** attempt)))
      }
    }
  }

  subscribeEntities(cb: (entities: EntityMap) => void) {
    this.entitySubs.add(cb)
    if (Object.keys(this.latest).length) cb(this.latest)
    return () => { this.entitySubs.delete(cb) }
  }

  subscribeConnection(cb: (s: ConnState) => void) {
    this.connSubs.add(cb); cb(this.connState)
    return () => { this.connSubs.delete(cb) }
  }

  async callService(domain: string, service: string, data: Record<string, any> = {}) {
    const conn = await this.connPromise
    const { entity_id, ...rest } = data
    await haCallService(conn, domain, service, rest, entity_id ? { entity_id } : undefined)
  }

  async getForecast(entityId: string): Promise<ForecastDay[]> {
    const conn = await this.connPromise
    const res: any = await haCallService(conn, 'weather', 'get_forecasts', { type: 'daily' }, { entity_id: entityId }, true)
    const list = res?.response?.[entityId]?.forecast ?? []
    return list.map((f: any) => ({ datetime: f.datetime, condition: f.condition, temperature: f.temperature, templow: f.templow }))
  }

  async getCalendarEvents(entityIds: string[], start: Date, end: Date): Promise<CalendarEvent[]> {
    const headers = { Authorization: `Bearer ${this.token}` }
    const q = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
    const all = await Promise.all(entityIds.map(async (id) => {
      try {
        const r = await fetch(`${this.url}/api/calendars/${id}${q}`, { headers })
        if (!r.ok) return []
        const items: any[] = await r.json()
        return items.map((ev) => {
          const allDay = !!ev.start?.date
          return { calendar: id, summary: ev.summary, allDay, start: allDay ? ev.start.date : ev.start.dateTime, end: allDay ? ev.end.date : ev.end.dateTime } as CalendarEvent
        })
      } catch (e) { console.error('calendar fetch failed', id, e); return [] }
    }))
    return all.flat().sort((a, b) => a.start.localeCompare(b.start))
  }

  async createCalendarEvent(entityId: string, ev: NewCalendarEvent): Promise<void> {
    const conn = await this.connPromise
    const data = ev.allDay
      ? { summary: ev.summary, description: ev.description, start_date: ev.start, end_date: ev.end }
      : { summary: ev.summary, description: ev.description, start_date_time: ev.start, end_date_time: ev.end }
    await haCallService(conn, 'calendar', 'create_event', data, { entity_id: entityId })
  }

  /** Kalender-Änderungen live: state_changed der Kalender-Entities (nächster Termin ändert sich) + jeder calendar.*-Service-Aufruf
   *  (Sprachassistent / Dashboard legt Termin an) + Event `smarthomeheart_calendar_refreshed` der HA-Automation nach dem iCloud-Abgleich. */
  subscribeCalendarChanges(cb: () => void) {
    let alive = true
    const unsubs: Array<() => void> = []
    const calIds = new Set(config.calendars.map((c) => c.entity))
    this.connPromise.then(async (conn) => {
      if (!alive) return
      const onEvent = (ev: any) => {
        const d = ev?.data ?? {}
        if (ev?.event_type === 'state_changed' && !calIds.has(d.entity_id)) return
        if (ev?.event_type === 'call_service' && d.domain !== 'calendar') return
        cb()
      }
      for (const type of ['state_changed', 'call_service', 'smarthomeheart_calendar_refreshed']) {
        unsubs.push(await conn.subscribeEvents(onEvent, type))
      }
      if (!alive) unsubs.forEach((u) => u())
    }).catch(console.error)
    return () => { alive = false; unsubs.forEach((u) => u()) }
  }

  private assist?: AssistClient
  async getAssist(): Promise<AssistLike | null> {
    const conn = await this.connPromise
    return this.assist ?? (this.assist = new AssistClient(conn, this.url, config.assistPipeline || undefined))
  }

  /** Sprachbefehle anderer Geräte (Handy-App, Satelliten) als Live-Untertitel – eigene Läufe des Dashboards werden ausgeblendet. */
  subscribeAssistRuns(cb: (s: AssistState) => void) {
    let stop: (() => void) | undefined, alive = true
    this.connPromise.then((conn) => {
      if (!alive) return
      stop = watchAssistRuns(conn, cb, { ignoreOwn: () => this.assist?.active ?? false })
    }).catch(console.error)
    return () => { alive = false; stop?.() }
  }
}
