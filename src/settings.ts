/**
 * Einstellungen, die auf dem Gerät gespeichert werden (localStorage) und ohne
 * Neu-Build änderbar sind: Erscheinungsbild (hell/dunkel/automatisch) und welche
 * Lichter auf der Startseite bzw. im „Alle Lichter"-Knopf liegen.
 *
 * `config.ts` bleibt die Voreinstellung – die Einstellungen überschreiben sie nur,
 * solange der Nutzer etwas gewählt hat („Zurücksetzen" löscht den Eintrag wieder).
 */
import { useSyncExternalStore } from 'react'
import { config } from './config'

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface Settings {
  theme: ThemeMode
  /** Lichter der Startseiten-Leiste, max. 4 – Reihenfolge = Anzeigereihenfolge */
  lights: string[]
  /** Entities, die der „Alle Lichter aus/an"-Knopf schaltet und anzeigt */
  allLights: string[]
}

export const MAX_LIGHTS = 4
const KEY = 'shh.settings.v1'

export const defaultSettings: Settings = {
  theme: 'light',
  lights: config.lights.map((l) => l.entity).slice(0, MAX_LIGHTS),
  allLights: [...config.allLights],
}

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSettings
    const p = JSON.parse(raw) as Partial<Settings>
    return {
      theme: p.theme === 'dark' || p.theme === 'auto' || p.theme === 'light' ? p.theme : defaultSettings.theme,
      lights: Array.isArray(p.lights) && p.lights.length ? p.lights.slice(0, MAX_LIGHTS) : defaultSettings.lights,
      allLights: Array.isArray(p.allLights) && p.allLights.length ? p.allLights : defaultSettings.allLights,
    }
  } catch {
    return defaultSettings // privater Modus / defektes JSON: Voreinstellung
  }
}

let current: Settings = read()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* Speichern optional */ }
  listeners.forEach((l) => l())
}

export function resetSettings() {
  try { localStorage.removeItem(KEY) } catch { /* egal */ }
  current = defaultSettings
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}

/** Anzeigename eines Lichts: Name aus config.ts, sonst friendly_name aus HA, sonst die ID. */
export function lightLabel(id: string, friendly?: string): string {
  const fromConfig = config.lights.find((l) => l.entity === id)?.name
  return fromConfig ?? friendly ?? id.split('.')[1].replace(/_/g, ' ')
}
