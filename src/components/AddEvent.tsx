import { useState } from 'react'
import { config } from '../config'
import { useHa } from '../ha/useHa'
import { Icon } from './Icons'
import { calendarBus } from './calendarData'

const ROWS = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnmß,.-', '1234567890']

/** Einfache Bildschirmtastatur – im Kiosk gibt es keine Systemtastatur. */
function Keyboard({ onKey, onBackspace, onSpace }: { onKey: (c: string) => void; onBackspace: () => void; onSpace: () => void }) {
  const [shift, setShift] = useState(true)
  const press = (c: string) => { onKey(shift ? c.toUpperCase() : c); setShift(false) }
  return (
    <div className="kbd">
      {ROWS.map((row, i) => (
        <div key={i} className="kbd-row">
          {i === 2 && <button className="kbd-key wide" onClick={() => setShift(!shift)} aria-label="Umschalt"><Icon.shift size={26} /></button>}
          {[...row].map((c) => <button key={c} className="kbd-key" onClick={() => press(c)}>{shift && i < 3 ? c.toUpperCase() : c}</button>)}
          {i === 2 && <button className="kbd-key wide" onClick={onBackspace} aria-label="Löschen"><Icon.backspace size={26} /></button>}
        </div>
      ))}
      <div className="kbd-row"><button className="kbd-key space" onClick={onSpace}>Leerzeichen</button></div>
    </div>
  )
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const step = (d: number) => onChange(Math.max(0, Math.min(23 * 60 + 45, value + d)))
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <button className="round" onClick={() => step(-15)} aria-label="Früher"><Icon.minus size={24} /></button>
      <span className="stepper-value">{fmt(value)}</span>
      <button className="round" onClick={() => step(15)} aria-label="Später"><Icon.plus size={24} /></button>
    </div>
  )
}

/** Termin manuell eintragen. Erinnerung ist immer an (HA-Automation, siehe README). */
export function AddEventSheet({ day, onClose }: { day: string; onClose: () => void }) {
  const ha = useHa()
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [start, setStart] = useState(9 * 60)
  const [end, setEnd] = useState(10 * 60)
  const [calendar, setCalendar] = useState(config.calendars[0]?.entity)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const date = new Date(day + 'T00:00:00')

  const save = async () => {
    if (!title.trim() || busy || !calendar) return
    setBusy(true); setError(null)
    try {
      const at = (min: number) => { const x = new Date(date); x.setMinutes(min); return x.toISOString() }
      const next = new Date(date); next.setDate(next.getDate() + 1)
      const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
      await ha.createCalendarEvent(calendar, allDay
        ? { summary: title.trim(), start: day, end: nextKey, allDay: true }
        : { summary: title.trim(), start: at(start), end: at(Math.max(end, start + 15)), allDay: false })
      calendarBus.dispatchEvent(new Event('changed'))
      onClose()
    } catch (e) { console.error(e); setError('Konnte nicht gespeichert werden'); setBusy(false) }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Neuer Termin · {date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}</h2>
          <button className="round" onClick={onClose} aria-label="Schließen"><Icon.close size={26} /></button>
        </div>

        <div className={`field ${title ? '' : 'placeholder'}`}>{title || 'Titel eingeben…'}<span className="caret" /></div>

        <div className="sheet-options">
          <button className={`pill ${allDay ? 'on' : ''}`} onClick={() => setAllDay(!allDay)}>Ganztags</button>
          {!allDay && <Stepper label="Von" value={start} onChange={(v) => { setStart(v); if (end <= v) setEnd(v + 60) }} />}
          {!allDay && <Stepper label="Bis" value={end} onChange={setEnd} />}
          {config.calendars.length > 1 && (
            <div className="cal-pick">
              {config.calendars.map((c) => <button key={c.entity} className={`pill cal-${c.color} ${calendar === c.entity ? 'on' : ''}`} onClick={() => setCalendar(c.entity)}>{c.name}</button>)}
            </div>
          )}
          <span className="reminder"><Icon.bell size={20} /> Erinnerung an</span>
        </div>

        <Keyboard onKey={(c) => setTitle((t) => t + c)} onBackspace={() => setTitle((t) => t.slice(0, -1))} onSpace={() => setTitle((t) => t + ' ')} />

        {error && <div className="error">{error}</div>}
        <button className="cta" disabled={!title.trim() || busy} onClick={save}>{busy ? 'Speichern…' : 'Termin speichern'}</button>
      </div>
    </div>
  )
}
