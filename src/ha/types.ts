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

export type NewCalendarEvent = Omit<CalendarEvent, 'calendar'> & { description?: string }

export type AssistPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
/** `source`: 'local' = Mikro des Dashboards, 'remote' = anderes Gerät (Handy-App, Satellit) – aus den Pipeline-Läufen in HA. */
/** `level` = aktueller Mikrofon-Pegel 0..1 (nur bei lokalem Lauf), damit die Wellen sich nur bewegen, wenn wirklich etwas zu hören ist. */
export interface AssistState { phase: AssistPhase; heard?: string; answer?: string; error?: string; source?: 'local' | 'remote'; level?: number }
/** Sprachassistent (Wake Word → STT → LLM → TTS). */
export interface AssistLike {
  subscribe(cb: (s: AssistState) => void): () => void
  /** Mikro öffnen und auf das Wake Word lauschen */
  start(): Promise<void>
  stop(): void
  /** Ohne Wake Word direkt zuhören (Antippen) */
  listenNow(): Promise<void>
}

export type ConnState = 'connecting' | 'connected' | 'disconnected' | 'demo'

export interface HaBackend {
  /** Liefert sofort den aktuellen Stand und dann jede Änderung. Gibt unsubscribe zurück. */
  subscribeEntities(cb: (entities: EntityMap) => void): () => void
  subscribeConnection(cb: (state: ConnState) => void): () => void
  callService(domain: string, service: string, data?: Record<string, any>): Promise<void>
  getForecast(entityId: string): Promise<ForecastDay[]>
  getCalendarEvents(entityIds: string[], start: Date, end: Date): Promise<CalendarEvent[]>
  /** Termin anlegen (HA-Service calendar.create_event) */
  createCalendarEvent(entityId: string, ev: NewCalendarEvent): Promise<void>
  /** Feuert, wenn sich in HA etwas an Kalendern getan hat (Entity-Status, calendar.*-Service, Refresh-Automation). Gibt unsubscribe zurück. */
  subscribeCalendarChanges(cb: () => void): () => void
  /** Sprachassistent; null wenn nicht verfügbar */
  getAssist(): Promise<AssistLike | null>
  /** Live-Untertitel für Sprachbefehle von *anderen* Geräten (Handy-App, Satelliten): beobachtet die Assist-Pipeline-Läufe in HA. */
  subscribeAssistRuns(cb: (s: AssistState) => void): () => void
}
