import { config } from '../config'
import { useEntities } from '../ha/useHa'
import { Icon } from './Icons'

const num = (s?: string) => { const n = Number(s); return s != null && s !== 'unknown' && s !== 'unavailable' && Number.isFinite(n) ? n : null }
const fmt1 = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Kopfzeile der Übersicht: Temperatur + Luftfeuchte drinnen/draußen (Zigbee-Sensoren, seit 2026-09-08). */
export function IndoorOutdoor() {
  const entities = useEntities()
  const rows = [
    { label: 'Drinnen', ...config.climate.indoor },
    { label: 'Draußen', ...config.climate.outdoor },
  ].map((r) => ({ label: r.label, t: num(entities[r.temperature]?.state), h: num(entities[r.humidity]?.state) }))
  if (rows.every((r) => r.t == null)) return null
  return (
    <div className="climate-strip">
      {rows.map((r) => (
        <div key={r.label} className="climate-item">
          <span className="climate-label">{r.label}</span>
          <span className="climate-temp"><Icon.thermo size={22} />{r.t != null ? `${fmt1(r.t)}°` : '–'}</span>
          {r.h != null && <span className="climate-hum"><Icon.drop size={18} />{Math.round(r.h)} %</span>}
        </div>
      ))}
    </div>
  )
}

/** Welche Pflanzen unter der Gieß-Schwelle liegen (Bodenfeuchte in %). Sensoren ohne Wert werden ignoriert. */
export function useThirstyPlants() {
  const entities = useEntities()
  return config.plants
    .map((p) => ({ ...p, value: num(entities[p.entity]?.state) }))
    .filter((p) => p.value != null && p.value < config.plantMoistureMin) as { entity: string; name: string; value: number }[]
}

/** Meldung „Blumen gießen“ – erscheint nur, wenn mindestens ein Gießsensor trocken meldet. */
export function PlantAlert({ small = false }: { small?: boolean }) {
  const thirsty = useThirstyPlants()
  if (!thirsty.length) return null
  return (
    <div className={`plant-alert ${small ? 'small' : ''}`} role="status">
      <span className="plant-icon"><Icon.drop size={small ? 24 : 32} /></span>
      <div className="plant-text">
        <div className="plant-title">Blumen gießen</div>
        <div className="plant-list">{thirsty.map((p) => `${p.name} (${Math.round(p.value)} %)`).join(' · ')}</div>
      </div>
    </div>
  )
}
