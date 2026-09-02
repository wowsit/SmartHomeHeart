import type { HaBackend, EntityMap, HaEntity, ConnState, ForecastDay, CalendarEvent } from './types'

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
    ent('weather.home', 'partlycloudy', {
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
      const w = this.entities['weather.home']
      this.patch('weather.home', { attributes: { ...w.attributes, temperature: Math.round((w.attributes.temperature + (Math.random() - 0.5) * 0.2) * 10) / 10 } })
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

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const d = (offsetDays: number, h: number, m = 0) => { const x = new Date(); x.setDate(x.getDate() + offsetDays); x.setHours(h, m, 0, 0); return x }
    const iso = (x: Date) => x.toISOString()
    const day = (offset: number) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10) }
    return [
      { calendar: 'calendar.familie', summary: 'Zahnarzt Lena', start: iso(d(0, 15, 30)), end: iso(d(0, 16, 15)), allDay: false },
      { calendar: 'calendar.arbeit', summary: 'Sprint Review', start: iso(d(0, 17, 0)), end: iso(d(0, 18, 0)), allDay: false },
      { calendar: 'calendar.familie', summary: 'Abendessen bei Oma', start: iso(d(0, 19, 0)), end: iso(d(0, 21, 0)), allDay: false },
      { calendar: 'calendar.familie', summary: 'Müllabfuhr (Gelber Sack)', start: day(1), end: day(2), allDay: true },
      { calendar: 'calendar.arbeit', summary: 'Kundentermin AC3', start: iso(d(1, 10, 0)), end: iso(d(1, 11, 30)), allDay: false },
      { calendar: 'calendar.familie', summary: 'Fußballtraining', start: iso(d(2, 17, 30)), end: iso(d(2, 19, 0)), allDay: false },
      { calendar: 'calendar.familie', summary: 'Geburtstag Max', start: day(4), end: day(5), allDay: true },
    ]
  }
}
