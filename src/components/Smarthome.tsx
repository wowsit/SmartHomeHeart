import { useEffect, useRef, useState } from 'react'
import { config, type RoomConfig } from '../config'
import { MAX_LIGHTS, lightLabel, useSettings } from '../settings'
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

/** Ein Licht-Panel der Startseite. Zeigt sofort den gewünschten Zustand („optimistisch"),
 *  bis Home Assistant den echten liefert – sonst tippt man auf dem Touch zweimal. */
function LightPanel({ id, name, e }: { id: string; name?: string; e?: HaEntity }) {
  const ha = useHa()
  const on = e?.state === 'on'
  const [wish, setWish] = useState<boolean | null>(null)
  if (wish !== null && wish === on) setWish(null) // HA hat den Wunsch übernommen – State-Anpassung im Render statt Effekt
  useEffect(() => {
    if (wish === null) return
    const t = setTimeout(() => setWish(null), 6000) // HA hat nicht reagiert: echten Zustand wieder zeigen
    return () => clearTimeout(t)
  }, [wish])

  const shown = wish ?? on
  const b = e?.attributes.brightness as number | undefined
  const pct = shown && wish === null && b != null ? Math.round((b / 255) * 100) : null
  const press = () => {
    if (!e) return
    const next = !shown
    setWish(next)
    ha.callService(domainOf(id), next ? 'turn_on' : 'turn_off', { entity_id: id })
  }
  return (
    <button className={`light-panel ${shown ? 'on' : ''} ${wish !== null ? 'pending' : ''} ${e ? '' : 'missing'}`}
      disabled={!e} onClick={press} aria-pressed={shown}>
      <span className="light-icon"><Icon.bulb size={30} /></span>
      <span className="light-name">{name ?? e?.attributes.friendly_name ?? id.split('.')[1]}</span>
      <span className="light-state">{!e ? 'Nicht gefunden' : wish !== null ? (wish ? 'Schalte an…' : 'Schalte aus…') : shown ? (pct != null ? `${pct} %` : 'An') : 'Aus'}</span>
    </button>
  )
}

/**
 * „Alle Lichter aus/an". Schaltet die Entities direkt (homeassistant.turn_on/off) statt über
 * ein HA-Skript – damit stimmen Knopf und Wirkung immer überein. Solange nicht alle Lichter
 * den Zielzustand haben, bleibt der Knopf im „Schalte…"-Zustand und fasst nach 2,5 s einzeln
 * nach; Zigbee/Matter verschluckt Sammelbefehle gelegentlich (genau das fühlte sich kaputt an).
 * Nochmal tippen dreht die Richtung sofort um.
 */
function AllLightsPanel({ ids, entities }: { ids: string[]; entities: EntityMap }) {
  const ha = useHa()
  const known = ids.map((id) => entities[id]).filter(Boolean)
  const total = known.length
  const onCount = known.filter((e) => e.state === 'on').length
  const [target, setTarget] = useState<'on' | 'off' | null>(null)
  const reached = target !== null && (target === 'on' ? onCount === total : onCount === 0)
  if (reached) setTarget(null) // Ziel erreicht – State-Anpassung im Render statt Effekt

  const send = (t: 'on' | 'off', list: string[]) => {
    if (list.length) ha.callService('homeassistant', t === 'on' ? 'turn_on' : 'turn_off', { entity_id: list })
  }

  useEffect(() => {
    if (!target) return
    const retry = setTimeout(() => {
      const missing = known.filter((e) => (e.state === 'on') !== (target === 'on')).map((e) => e.entity_id)
      missing.forEach((id) => send(target, [id])) // einzeln nachfassen
    }, 2500)
    const giveUp = setTimeout(() => setTarget(null), 9000)
    return () => { clearTimeout(retry); clearTimeout(giveUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, onCount, total])

  const press = () => {
    if (!total) return
    const t: 'on' | 'off' = target ? (target === 'on' ? 'off' : 'on') : onCount > 0 ? 'off' : 'on'
    setTarget(t)
    send(t, known.map((e) => e.entity_id))
  }

  const label = target ? (target === 'on' ? 'Alle Lichter an' : 'Alle Lichter aus')
    : onCount ? 'Alle Lichter aus' : 'Alle Lichter an'
  const state = !total ? 'Nicht gefunden'
    : target ? `Schalte ${target === 'on' ? 'an' : 'aus'}… ${onCount}/${total}`
      : onCount ? `${onCount} von ${total} an` : 'Alles aus'
  return (
    <button className={`light-panel all-off ${onCount ? 'on' : ''} ${target ? 'pending' : ''}`} disabled={!total} onClick={press}>
      <span className="light-icon"><Icon.power size={30} /></span>
      <span className="light-name">{label}</span>
      <span className="light-state">{state}</span>
    </button>
  )
}

/** Übersicht: bis zu 4 frei wählbare Lichter (Einstellungen) + Umschalter „Alle Lichter aus/an" */
export function LightsWidget() {
  const entities = useEntities()
  const s = useSettings()
  const lights = s.lights.slice(0, MAX_LIGHTS)
  return (
    <div className="lights" style={{ gridTemplateColumns: `repeat(${lights.length + 1}, minmax(0, 1fr))` }}>
      {lights.map((id) => (
        <LightPanel key={id} id={id} name={lightLabel(id, entities[id]?.attributes.friendly_name)} e={entities[id]} />
      ))}
      <AllLightsPanel ids={s.allLights} entities={entities} />
    </div>
  )
}
