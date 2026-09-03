import { useEffect, useRef, useState } from 'react'
import { config, type RoomConfig } from '../config'
import { useEntities, useHa } from '../ha/useHa'
import type { EntityMap, HaEntity } from '../ha/types'
import { Icon } from './Icons'

const domainOf = (id: string) => id.split('.')[0]

/** Kachel: Licht/Schalter – Tippen schaltet, bei Lampen zusätzlich Helligkeits-Slider */
export function ToggleTile({ e, showSlider = false }: { e: HaEntity; showSlider?: boolean }) {
  const ha = useHa()
  const on = e.state === 'on'
  const domain = domainOf(e.entity_id)
  const isLight = domain === 'light'
  const [pending, setPending] = useState(false)
  const brightness = e.attributes.brightness as number | undefined
  const pct = isLight && on && brightness != null ? Math.round((brightness / 255) * 100) : null

  const toggle = async () => {
    if (pending) return
    setPending(true)
    try { await ha.callService(domain, 'toggle', { entity_id: e.entity_id }) } finally { setTimeout(() => setPending(false), 150) }
  }

  return (
    <div className={`tile ${on ? 'on' : ''} ${pending ? 'pending' : ''}`}>
      <button className="tile-main" onClick={toggle} aria-pressed={on}>
        <span className="tile-icon">{isLight ? <Icon.bulb size={28} /> : <Icon.power size={28} />}</span>
        <span className="tile-name">{e.attributes.friendly_name ?? e.entity_id}</span>
        <span className="tile-state">{on ? (pct != null ? `${pct} %` : 'An') : 'Aus'}</span>
      </button>
      {showSlider && isLight && (
        <BrightnessSlider entityId={e.entity_id} value={on ? (brightness ?? 255) : 0} />
      )}
    </div>
  )
}

function BrightnessSlider({ entityId, value }: { entityId: string; value: number }) {
  const ha = useHa()
  const [local, setLocal] = useState(value)
  const dragging = useRef(false)
  useEffect(() => { if (!dragging.current) setLocal(value) }, [value])
  const commit = (v: number) => {
    dragging.current = false
    if (v === 0) ha.callService('light', 'turn_off', { entity_id: entityId })
    else ha.callService('light', 'turn_on', { entity_id: entityId, brightness: v })
  }
  return (
    <input type="range" className="slider" min={0} max={255} step={5} value={local}
      onPointerDown={() => { dragging.current = true }}
      onChange={(ev) => setLocal(Number(ev.target.value))}
      onPointerUp={(ev) => commit(Number((ev.target as HTMLInputElement).value))}
      onKeyUp={(ev) => commit(Number((ev.target as HTMLInputElement).value))}
      aria-label="Helligkeit" />
  )
}

export function ClimateTile({ e }: { e: HaEntity }) {
  const ha = useHa()
  const step = e.attributes.target_temp_step ?? 0.5
  const target = e.attributes.temperature as number
  const [local, setLocal] = useState(target)
  const [seenTarget, setSeenTarget] = useState(target)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  if (target !== seenTarget) { setSeenTarget(target); setLocal(target) } // HA-Wert übernehmen, sobald er sich ändert
  const change = (d: number) => {
    const v = Math.round(Math.min(e.attributes.max_temp ?? 30, Math.max(e.attributes.min_temp ?? 7, local + d)) * 10) / 10
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => ha.callService('climate', 'set_temperature', { entity_id: e.entity_id, temperature: v }), 600)
  }
  const heating = e.attributes.hvac_action === 'heating'
  return (
    <div className={`tile climate ${heating ? 'on warm' : ''}`}>
      <div className="tile-main static">
        <span className="tile-icon"><Icon.thermo size={28} /></span>
        <span className="tile-name">{e.attributes.friendly_name ?? 'Heizung'}</span>
        <span className="tile-state">{Number(e.attributes.current_temperature).toFixed(1)}° {heating ? '· heizt' : ''}</span>
      </div>
      <div className="climate-ctrl">
        <button className="round" onClick={() => change(-step)} aria-label="kälter"><Icon.minus /></button>
        <div className="climate-target">{local.toFixed(1)}°</div>
        <button className="round" onClick={() => change(step)} aria-label="wärmer"><Icon.plus /></button>
      </div>
    </div>
  )
}

export function EntityTile({ e, showSlider }: { e: HaEntity; showSlider?: boolean }) {
  if (domainOf(e.entity_id) === 'climate') return <ClimateTile e={e} />
  return <ToggleTile e={e} showSlider={showSlider} />
}

export function Scenes() {
  const ha = useHa()
  const [active, setActive] = useState<string | null>(null)
  const run = async (id: string) => {
    setActive(id)
    try { await ha.callService('scene', 'turn_on', { entity_id: id }) } finally { setTimeout(() => setActive(null), 600) }
  }
  return (
    <div className="scenes">
      {config.scenes.map((s) => (
        <button key={s.id} className={`scene ${active === s.id ? 'active' : ''}`} onClick={() => run(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  )
}

/** Raumkachel für die Übersicht: Name, Zustand in einem Satz, Temperatur. Tippen schaltet alle Lichter im Raum. */
export function RoomSummary({ room, entities }: { room: RoomConfig; entities: EntityMap }) {
  const ha = useHa()
  const lights = room.entities.filter((id) => domainOf(id) !== 'climate').map((id) => entities[id]).filter(Boolean)
  const onCount = lights.filter((e) => e.state === 'on').length
  const climate = room.entities.map((id) => entities[id]).find((e) => e && domainOf(e.entity_id) === 'climate')
  const anyOn = onCount > 0
  const toggleAll = () => {
    const ids = lights.map((e) => e.entity_id)
    if (!ids.length) return
    ha.callService('homeassistant', anyOn ? 'turn_off' : 'turn_on', { entity_id: ids })
  }
  const status = !anyOn ? 'Aus' : onCount === lights.length ? (lights.length === 1 ? 'An' : 'Alles an') : `${onCount} von ${lights.length} an`
  return (
    <button className={`room ${anyOn ? 'on' : ''}`} onClick={toggleAll}>
      <span className="room-icon"><Icon.bulb size={28} /></span>
      <span className="room-name">{room.name}</span>
      <span className="room-status">{status}</span>
      {climate && <span className="room-temp">{Number(climate.attributes.current_temperature).toFixed(1)}°</span>}
    </button>
  )
}

export function SmarthomePage() {
  const entities = useEntities()
  return (
    <div className="page smarthome">
      <div className="rooms-grid">
        {config.rooms.map((room) => (
          <section key={room.name} className="card room-section">
            <h2>{room.name}</h2>
            <div className="tiles">
              {room.entities.map((id) => entities[id]
                ? <EntityTile key={id} e={entities[id]} showSlider />
                : <div key={id} className="tile missing"><div className="tile-main static"><span className="tile-name">{id}</span><span className="tile-state">nicht gefunden</span></div></div>)}
            </div>
          </section>
        ))}
      </div>
      <section>
        <h3>Szenen</h3>
        <Scenes />
      </section>
    </div>
  )
}

/** Übersicht: 4 Panels für die wichtigsten Lichter (config.lights) */
export function LightsWidget() {
  const entities = useEntities()
  const ha = useHa()
  return (
    <div className="lights">
      {config.lights.slice(0, 4).map(({ entity: id, name }) => {
        const e = entities[id]
        const on = e?.state === 'on'
        const b = e?.attributes.brightness as number | undefined
        const pct = on && b != null ? Math.round((b / 255) * 100) : null
        return (
          <button key={id} className={`light-panel ${on ? 'on' : ''} ${e ? '' : 'missing'}`} disabled={!e}
            onClick={() => ha.callService(domainOf(id), 'toggle', { entity_id: id })}>
            <span className="light-icon"><Icon.bulb size={30} /></span>
            <span className="light-name">{name ?? e?.attributes.friendly_name ?? id.split('.')[1]}</span>
            <span className="light-state">{!e ? 'Nicht gefunden' : on ? (pct != null ? `${pct} %` : 'An') : 'Aus'}</span>
          </button>
        )
      })}
    </div>
  )
}
