/**
 * Nur ein Teil des Dashboards darf das Mikrofon halten. Der Sprachassistent gibt es frei,
 * solange die Wake-Word-Aufnahme läuft (Chromium liefert denselben Stream sonst doppelt und
 * die Aufnahme bekommt das Echo der Assist-Wiedergabe mit).
 */
let locked = false
const listeners = new Set<(l: boolean) => void>()

export function micLocked() {
  return locked
}

export function lockMic(on: boolean) {
  if (locked === on) return
  locked = on
  listeners.forEach((l) => l(locked))
}

export function onMicLock(cb: (locked: boolean) => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
