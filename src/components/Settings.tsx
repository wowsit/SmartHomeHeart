/**
 * Einstellungen (Zahnrad in der Navigation): Erscheinungsbild und welche Lichter
 * auf der Startseite bzw. im „Alle Lichter"-Knopf liegen. Alles wird lokal
 * gespeichert (siehe settings.ts) und wirkt sofort, ohne Neu-Build.
 */
import { useEffect } from 'react'
import { useEntities } from '../ha/useHa'
import { useNow } from '../hooks/useNow'
import { Icon } from './Icons'
import { MAX_LIGHTS, lightLabel, resetSettings, setSettings, useSettings, type ThemeMode } from '../settings'
import type { EntityMap } from '../ha/types'

const THEMES: { id: ThemeMode; label: string; icon: 'sun' | 'moon' | 'cloudSun' }[] = [
  { id: 'light', label: 'Hell', icon: 'sun' },
  { id: 'dark', label: 'Dunkel', icon: 'moon' },
  { id: 'auto', label: 'Automatisch', icon: 'cloudSun' },
]

/** Alle schaltbaren Lichter/Steckdosen aus HA, alphabetisch – Grundlage der Auswahllisten. */
function switchableEntities(entities: EntityMap) {
  return Object.values(entities)
    .filter((e) => e.entity_id.startsWith('light.') || e.entity_id.startsWith('switch.'))
    .map((e) => ({ id: e.entity_id, label: lightLabel(e.entity_id, e.attributes.friendly_name as string | undefined) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

/** Auswahlliste: antippen wählt aus/ab. `limit` begrenzt die Auswahl (dann fällt das älteste raus). */
function EntityPicker({ options, selected, onChange, limit }: {
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  limit?: number
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      const next = selected.filter((x) => x !== id)
      if (next.length) onChange(next) // mindestens eines muss bleiben
      return
    }
    const next = [...selected, id]
    onChange(limit ? next.slice(-limit) : next)
  }
  return (
    <div className="pick-list">
      {options.length === 0 && <div className="empty">Keine Lichter gefunden – ist Home Assistant verbunden?</div>}
      {options.map((o) => {
        const idx = selected.indexOf(o.id)
        return (
          <button key={o.id} className={`pick ${idx >= 0 ? 'on' : ''}`} onClick={() => toggle(o.id)} aria-pressed={idx >= 0}>
            <span className="pick-num">{idx >= 0 ? idx + 1 : ''}</span>
            <span className="pick-text">
              <span className="pick-label">{o.label}</span>
              <span className="pick-id">{o.id}</span>
            </span>
            {idx >= 0 && <Icon.check size={26} />}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const entities = useEntities()
  const options = switchableEntities(entities)
  // Bereits gewählte IDs, die HA (noch) nicht liefert, trotzdem anzeigen – sonst wären sie unsichtbar abwählbar.
  const missing = [...s.lights, ...s.allLights].filter((id) => !options.some((o) => o.id === id))
  const allOptions = [...options, ...[...new Set(missing)].map((id) => ({ id, label: `${lightLabel(id)} (offline)` }))]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Einstellungen</h2>
          <button className="round" onClick={onClose} aria-label="Schließen"><Icon.close /></button>
        </div>

        <div className="settings-scroll">
          <section>
            <h3>Erscheinungsbild</h3>
            <div className="seg">
              {THEMES.map((t) => { const I = Icon[t.icon]; return (
                <button key={t.id} className={`seg-btn ${s.theme === t.id ? 'on' : ''}`} onClick={() => setSettings({ theme: t.id })}>
                  <I size={26} /><span>{t.label}</span>
                </button>
              ) })}
            </div>
            <p className="hint">Automatisch = dunkel nach Sonnenuntergang (Sonnenstand aus Home&nbsp;Assistant).</p>
          </section>

          <section>
            <h3>Lichter auf der Startseite · {s.lights.length}/{MAX_LIGHTS}</h3>
            <EntityPicker options={allOptions} selected={s.lights} limit={MAX_LIGHTS}
              onChange={(lights) => setSettings({ lights })} />
          </section>

          <section>
            <h3>„Alle Lichter“-Knopf schaltet · {s.allLights.length}</h3>
            <EntityPicker options={allOptions} selected={s.allLights}
              onChange={(allLights) => setSettings({ allLights })} />
          </section>
        </div>

        <div className="sheet-options">
          <button className="pill" onClick={resetSettings}>Zurücksetzen</button>
          <button className="cta grow" onClick={onClose}>Fertig</button>
        </div>
      </div>
    </div>
  )
}

/** Setzt data-theme am <html>, damit die dunklen Farbwerte greifen. */
export function ThemeApplier() {
  const s = useSettings()
  const entities = useEntities()
  const now = useNow(60_000) // damit „Automatisch" auch ohne HA-Sonnenstand zur Stunde umschaltet
  const sun = entities['sun.sun']?.state
  const night = sun ? sun === 'below_horizon' : now.getHours() >= 20 || now.getHours() < 7
  const dark = s.theme === 'dark' || (s.theme === 'auto' && night)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    root.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  return null
}
