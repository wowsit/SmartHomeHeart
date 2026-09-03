import { config } from '../config'
import type { NewCalendarEvent, HaBackend, EntityMap, HaEntity, ConnState, ForecastDay, CalendarEvent } from './types'

function ent(entity_id: string, state: string, attributes: Record<string, any> = {}): HaEntity {
  return { entity_id, state, attributes, last_changed: new Date().toISOString() }
}

const light = (id: string, name: string, on: boolean, brightness = 200) =>
  ent(id, on ? 'on' : 'off', { friendly_name: name, brightness: on ? brightness : undefined, supported_color_modes: ['brightness'] })
const sw = (id: string, name: string, on: boolean) => ent(id, on ? 'on' : 'off', { friendly_name: name })
const climate = (id: string, name: string, current: number, target: number) =>
  ent(id, 'heat', { friendly_name: name, current_temperature: current, temperature: target, hvac_action: current < target ? 'heating' : 'idle', min_temp: 7, max_temp: 30, target_temp_step: 0.5 })

function initialEntities(): EntityMap {
  const list: HaEntity[] = [
    light('light.wohnzimmer_decke', 'Deckenlampe', true, 180),
    light('light.wohnzimmer_stehlampe', 'Stehlampe', true, 90),
    climate('climate.wohnzimmer', 'Heizung', 21.4, 22),
    light('light.kueche_decke', 'Deckenlicht', false),
    light('light.kueche_arbeitsplatte', 'Arbeitsplatte', true, 255),
    sw('switch.kaffeemaschine', 'Kaffeemaschine', false),
    light('light.schlafzimmer', 'Deckenlampe', false),
    light('light.nachttisch', 'Nachttisch', false),
    climate('climate.schlafzimmer', 'Heizung', 18.9, 19),
    light('light.bad', 'Bad', false),
    sw('switch.handtuchheizung', 'Handtuchheizung', true),
    light('light.flur', 'Flur', true, 120),
    sw('switch.steckdose_flur', 'Steckdose', false),
    light('light.buero', 'Büro', true, 230),
    sw('switch.schreibtisch', 'Schreibtisch', true),
    ent(config.weather, 'partlycloudy', {
      friendly_name: 'Zuhause', temperature: 19.5, humidity: 58, wind_speed: 14.2, wind_bearing: 240,
      pressure: 1014, temperature_unit: '°C', wind_speed_unit: 'km/h',
    }),
    ent('media_player.wohnzimmer', 'playing', {
      friendly_name: 'Wohnzimmer', media_title: 'Midnight City', media_artist: 'M83', media_album_name: 'Hurry Up, We\'re Dreaming',
      volume_level: 0.35, media_duration: 243, media_position: 61, media_position_updated_at: new Date().toISOString(), shuffle: false,
    }),
    ...['scene.gemuetlich', 'scene.film', 'scene.alles_aus', 'scene.gute_nacht'].map((id) => ent(id, 'scening', {})),
  ]
  return Object.fromEntries(list.map((e) => [e.entity_id, e]))
}

const conditions = ['sunny', 'partlycloudy', 'cloudy', 'rainy', 'sunny', 'partlycloudy', 'clear-night']

export class MockBackend implements HaBackend {
  private entities = initialEntities()
  private subs = new Set<(e: EntityMap) => void>()
  private timer: ReturnType<typeof setInterval>

  constructor() {
    // kleine Live-Änderungen, damit man sieht, dass Updates durchkommen
    this.timer = setInterval(() => {
      const w = this.entities[config.weather]
      this.patch(config.weather, { attributes: { ...w.attributes, temperature: Math.round((w.attributes.temperature + (Math.random() - 0.5) * 0.2) * 10) / 10 } })
      const m = this.entities['media_player.wohnzimmer']
      if (m.state === 'playing') {
        const pos = (m.attributes.media_position ?? 0) + 5
        if (pos >= m.attributes.media_duration) this.nextTrack()
        else this.patch(m.entity_id, { attributes: { ...m.attributes, media_position: pos, media_position_updated_at: new Date().toISOString() } })
      }
    }, 5000)
  }

  dispose() { clearInterval(this.timer) }

  private emit() { const snap = { ...this.entities }; this.subs.forEach((cb) => cb(snap)) }

  private patch(id: string, p: Partial<HaEntity>) {
    const cur = this.entities[id]
    if (!cur) return
    this.entities[id] = { ...cur, ...p, last_changed: new Date().toISOString() }
    this.emit()
  }

  subscribeEntities(cb: (entities: EntityMap) => void) {
    this.subs.add(cb)
    cb({ ...this.entities })
    return () => { this.subs.delete(cb) }
  }

  subscribeConnection(cb: (s: ConnState) => void) { cb('demo'); return () => {} }

  private tracks = [
    ['Midnight City', 'M83', 243], ['Blinding Lights', 'The Weeknd', 200], ['Instant Crush', 'Daft Punk', 337], ['Electric Feel', 'MGMT', 229],
  ] as const
  private trackIdx = 0
  private nextTrack(dir = 1) {
    this.trackIdx = (this.trackIdx + dir + this.tracks.length) % this.tracks.length
    const [title, artist, dur] = this.tracks[this.trackIdx]
    const m = this.entities['media_player.wohnzimmer']
    this.patch(m.entity_id, { attributes: { ...m.attributes, media_title: title, media_artist: artist, media_duration: dur, media_position: 0, media_position_updated_at: new Date().toISOString() } })
  }

  async callService(domain: string, service: string, data: Record<string, any> = {}) {
    await new Promise((r) => setTimeout(r, 120)) // simulierte Latenz
    const ids: string[] = ([] as string[]).concat(data.entity_id ?? [])
    for (const id of ids) {
      const e = this.entities[id]
      if (!e) continue
      if (domain === 'light' || domain === 'switch' || domain === 'homeassistant') {
        const turnOn = service === 'turn_on' || (service === 'toggle' && e.state === 'off')
        const attrs = { ...e.attributes }
        if (domain === 'light' && data.brightness != null) attrs.brightness = data.brightness
        if (turnOn && attrs.brightness == null && id.startsWith('light.')) attrs.brightness = 200
        this.patch(id, { state: turnOn ? 'on' : 'off', attributes: attrs })
      } else if (domain === 'climate' && service === 'set_temperature') {
        this.patch(id, { attributes: { ...e.attributes, temperature: data.temperature } })
      } else if (domain === 'media_player') {
        if (service === 'media_play_pause') this.patch(id, { state: e.state === 'playing' ? 'paused' : 'playing' })
        if (service === 'media_play') this.patch(id, { state: 'playing' })
        if (service === 'media_pause') this.patch(id, { state: 'paused' })
        if (service === 'media_next_track') this.nextTrack(1)
        if (service === 'media_previous_track') this.nextTrack(-1)
        if (service === 'volume_set') this.patch(id, { attributes: { ...e.attributes, volume_level: data.volume_level } })
      } else if (domain === 'scene') {
        const all = Object.keys(this.entities).filter((k) => k.startsWith('light.'))
        if (id === 'scene.alles_aus' || id === 'scene.gute_nacht') all.forEach((k) => this.patch(k, { state: 'off' }))
        if (id === 'scene.gemuetlich') all.forEach((k) => this.patch(k, { state: 'on', attributes: { ...this.entities[k].attributes, brightness: 80 } }))
        if (id === 'scene.film') all.forEach((k) => this.patch(k, { state: k.includes('stehlampe') ? 'on' : 'off', attributes: { ...this.entities[k].attributes, brightness: 40 } }))
      }
    }
  }

  async getForecast(): Promise<ForecastDay[]> {
    const today = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i + 1)
      return { datetime: d.toISOString(), condition: conditions[i % conditions.length], temperature: 18 + Math.round(Math.sin(i) * 5), templow: 9 + Math.round(Math.cos(i) * 3) }
    })
  }

  private extraEvents: CalendarEvent[] = []

  async createCalendarEvent(entityId: string, ev: NewCalendarEvent): Promise<void> {
    this.extraEvents.push({ ...ev, calendar: entityId })
  }

  async getCalendarEvents(entityIds: string[], start: Date, end: Date): Promise<CalendarEvent[]> {
    const cal = entityIds[0] ?? 'calendar.meine_termine'
    const second = entityIds[1]
    const now = new Date()
    const at = (day: number, h: number, m = 0) => { const x = new Date(now.getFullYear(), now.getMonth(), day, h, m); return x.toISOString() }
    const allDay = (day: number, len = 1) => {
      const a = new Date(now.getFullYear(), now.getMonth(), day); const b = new Date(a); b.setDate(b.getDate() + len)
      const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      return [f(a), f(b)] as const
    }
    const t = now.getDate()
    const list: CalendarEvent[] = [
      { calendar: cal, summary: 'Zahnarzt', start: at(t, 15, 30), end: at(t, 16, 15), allDay: false },
      { calendar: cal, summary: 'Abendessen bei Oma', start: at(t, 19, 0), end: at(t, 21, 0), allDay: false },
      { calendar: cal, summary: 'Müllabfuhr (Gelber Sack)', start: allDay(t + 1)[0], end: allDay(t + 1)[1], allDay: true },
      { calendar: cal, summary: 'Fußballtraining', start: at(t + 2, 17, 30), end: at(t + 2, 19, 0), allDay: false },
      { calendar: cal, summary: 'Geburtstag Max', start: allDay(t + 4)[0], end: allDay(t + 4)[1], allDay: true },
      { calendar: cal, summary: 'Fußballtraining', start: at(t + 9, 17, 30), end: at(t + 9, 19, 0), allDay: false },
      { calendar: cal, summary: 'Autowerkstatt', start: at(t + 6, 8, 0), end: at(t + 6, 9, 0), allDay: false },
      { calendar: cal, summary: 'Elternabend', start: at(t + 12, 19, 0), end: at(t + 12, 20, 30), allDay: false },
      { calendar: cal, summary: 'Wochenende Ostsee', start: allDay(t + 16, 3)[0], end: allDay(t + 16, 3)[1], allDay: true },
      { calendar: cal, summary: 'Friseur', start: at(3, 10, 0), end: at(3, 11, 0), allDay: false },
      { calendar: cal, summary: 'Kino', start: at(1, 20, 0), end: at(1, 22, 30), allDay: false },
    ]
    if (second) list.push({ calendar: second, summary: 'Sprint Review', start: at(t, 17, 0), end: at(t, 18, 0), allDay: false }, { calendar: second, summary: 'Kundentermin', start: at(t + 1, 10, 0), end: at(t + 1, 11, 30), allDay: false })
    list.push(...this.extraEvents)
    const s = start.getTime(), e = end.getTime()
    return list.filter((ev) => new Date(ev.end).getTime() >= s && new Date(ev.start).getTime() <= e).sort((a, b) => a.start.localeCompare(b.start))
  }
}
