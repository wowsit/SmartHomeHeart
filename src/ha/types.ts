export interface HaEntity {
  entity_id: string
  state: string
  attributes: Record<string, any>
  last_changed?: string
}

export type EntityMap = Record<string, HaEntity>

export interface ForecastDay {
  datetime: string
  condition: string
  temperature: number
  templow: number
}

export interface CalendarEvent {
  calendar: string
  summary: string
  start: string // ISO date or datetime
  end: string
  allDay: boolean
}

export type ConnState = 'connecting' | 'connected' | 'disconnected' | 'demo'

export interface HaBackend {
  /** Liefert sofort den aktuellen Stand und dann jede Änderung. Gibt unsubscribe zurück. */
  subscribeEntities(cb: (entities: EntityMap) => void): () => void
  subscribeConnection(cb: (state: ConnState) => void): () => void
  callService(domain: string, service: string, data?: Record<string, any>): Promise<void>
  getForecast(entityId: string): Promise<ForecastDay[]>
  getCalendarEvents(entityIds: string[], start: Date, end: Date): Promise<CalendarEvent[]>
}
