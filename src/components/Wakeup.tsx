/**
 * Wakeup-Song (Musik-Seite): Song per Spracheingabe wählen, Uhrzeit einstellen, an/aus.
 * Abgespielt wird von Home Assistant (Automation `wakeup_song`): Anlage an → genau ein Song → Anlage aus.
 * Die Spracheingabe nutzt dieselbe STT-Engine wie der Sprachassistent (REST /api/stt), der gesprochene
 * Wunsch wird über music_assistant.search zu einem eindeutigen Titel aufgelöst und als URI gespeichert.
 */
import { useEffect, useRef, useState } from 'react'
import { config } from '../config'
import { useEntities, useHa } from '../ha/useHa'
import { ClipRecorder } from '../ha/recorder'
import { lockMic } from '../ha/micLock'
import { Icon } from './Icons'

type Phase = 'idle' | 'countdown' | 'recording' | 'thinking'
const RECORD_SECS = 4

/** „Bohemian Rhapsody von Queen“ → { name, artist } */
function splitWish(text: string): { name: string; artist?: string } {
  const t = text.replace(/[.!?]+$/g, '').replace(/^(spiel(e)?|bitte)\s+/i, '').trim()
  const m = t.match(/^(.+?)\s+(?:von|from|by)\s+(.+)$/i)
  return m ? { name: m[1].trim(), artist: m[2].trim() } : { name: t }
}

export function WakeupCard() {
  const ha = useHa()
  const entities = useEntities()
  const song = entities[config.wakeup.song]
  const time = entities[config.wakeup.time]
  const active = entities[config.wakeup.active]
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<ClipRecorder | null>(null)
  useEffect(() => () => { rec.current?.close(); lockMic(false) }, [])

  const missing = !song || !time || !active
  const songText = song?.state && !['unknown', 'unavailable', ''].includes(song.state) ? song.state : null
  const isActive = active?.state === 'on'

  const listen = async () => {
    if (phase !== 'idle') return
    setError(null); setHeard(null)
    lockMic(true) // Assistent pausiert, damit nicht beide das Mikrofon halten
    try {
      const r = rec.current ?? (rec.current = new ClipRecorder())
      r.onLevel = setLevel
      await r.open()
      setPhase('countdown')
      await new Promise((res) => setTimeout(res, 900)) // Assistent hat das Mikro freigegeben
      setPhase('recording')
      const clip = await r.record(RECORD_SECS)
      r.close(); rec.current = null
      setPhase('thinking')
      if (clip.peak < 0.01) throw new Error('Nichts gehört – bitte näher ans Display und noch einmal.')
      const text = await ha.transcribe(clip.blob)
      if (!text) throw new Error('Nichts verstanden – noch einmal versuchen.')
      setHeard(text)
      const wish = splitWish(text)
      const res = await ha.callServiceWithResponse('music_assistant', 'search', {
        config_entry_id: config.musicAssistantEntryId,
        name: wish.name,
        ...(wish.artist ? { artist: wish.artist } : {}),
        media_type: ['track'],
        limit: 5,
      })
      const track = (res?.tracks ?? [])[0]
      if (!track?.uri) throw new Error(`Kein Titel gefunden für „${text}“.`)
      const artists = (track.artists ?? []).map((a: any) => a.name).filter(Boolean).join(', ')
      const label = artists ? `${track.name} – ${artists}` : track.name
      await ha.callService('input_text', 'set_value', { entity_id: config.wakeup.uri, value: String(track.uri).slice(0, 255) })
      await ha.callService('input_text', 'set_value', { entity_id: config.wakeup.song, value: label.slice(0, 255) })
      if (!isActive) await ha.callService('input_boolean', 'turn_on', { entity_id: config.wakeup.active })
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      rec.current?.close(); rec.current = null
      lockMic(false)
      setPhase('idle'); setLevel(0)
    }
  }

  if (missing) {
    return <div className="card wakeup"><div className="card-title">Wakeup-Song</div><div className="empty">Helfer in Home Assistant fehlen ({[config.wakeup.song, config.wakeup.time, config.wakeup.active].filter((id) => !entities[id]).join(', ')})</div></div>
  }

  return (
    <div className={`card wakeup ${isActive ? 'active' : ''}`}>
      <div className="wakeup-head">
        <div className="card-title">Wakeup-Song</div>
        <button className={`switch ${isActive ? 'on' : ''}`} onClick={() => ha.callService('input_boolean', 'toggle', { entity_id: config.wakeup.active })} aria-pressed={isActive} aria-label="Wakeup-Song an/aus">
          <span className="switch-knob" />
        </button>
      </div>
      <div className="wakeup-body">
        <button className={`wakeup-mic ${phase}`} onClick={listen} disabled={phase !== 'idle'} aria-label="Song per Sprache wählen"
          style={{ ['--level' as any]: level }}>
          <span className="wakeup-ring" />
          {phase === 'thinking' ? <Icon.music size={36} /> : <Icon.mic size={36} />}
        </button>
        <div className="wakeup-info">
          <div className="wakeup-song">
            {phase === 'countdown' && 'Gleich …'}
            {phase === 'recording' && 'Sag den Song – z. B. „Here Comes the Sun von The Beatles“'}
            {phase === 'thinking' && (heard ? `Suche „${heard}“ …` : 'Verstehe …')}
            {phase === 'idle' && (songText ?? 'Noch kein Song – Mikro antippen und den Titel sagen')}
          </div>
          <div className="wakeup-hint">
            {error ? <span className="wakeup-error">{error}</span>
              : isActive ? `Spielt täglich um ${fmtTime(time.state)} genau einen Song, danach geht die Anlage wieder aus.`
                : 'Aus – Schalter oben rechts aktiviert den Wecker.'}
          </div>
        </div>
        <TimePicker state={time.state} onChange={(hhmm) => ha.callService('input_datetime', 'set_datetime', { entity_id: config.wakeup.time, time: `${hhmm}:00` })} />
      </div>
    </div>
  )
}

const fmtTime = (s: string) => (s && s !== 'unknown' ? s.slice(0, 5) : '--:--')

/** Uhrzeit per +/- (Stunde, 5-Minuten-Schritte) – Touch-freundlicher als das native Zeitfeld im Kiosk. */
function TimePicker({ state, onChange }: { state: string; onChange: (hhmm: string) => void }) {
  const parse = (s: string) => { const [h, m] = s.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? { h, m } : { h: 7, m: 0 } }
  const [local, setLocal] = useState(parse(state))
  const [seen, setSeen] = useState(state)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  if (state !== seen) { setSeen(state); setLocal(parse(state)) } // HA-Wert übernehmen, sobald er sich ändert
  const change = (dh: number, dm: number) => {
    let total = ((local.h * 60 + local.m + dh * 60 + dm) % 1440 + 1440) % 1440
    if (dm) total = Math.round(total / 5) * 5 % 1440
    const next = { h: Math.floor(total / 60), m: total % 60 }
    setLocal(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(`${String(next.h).padStart(2, '0')}:${String(next.m).padStart(2, '0')}`), 700)
  }
  const two = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="timepick">
      <div className="timepick-col">
        <button className="round" onClick={() => change(1, 0)} aria-label="Stunde +"><Icon.plus /></button>
        <div className="timepick-val">{two(local.h)}</div>
        <button className="round" onClick={() => change(-1, 0)} aria-label="Stunde −"><Icon.minus /></button>
      </div>
      <div className="timepick-sep">:</div>
      <div className="timepick-col">
        <button className="round" onClick={() => change(0, 5)} aria-label="Minuten +5"><Icon.plus /></button>
        <div className="timepick-val">{two(local.m)}</div>
        <button className="round" onClick={() => change(0, -5)} aria-label="Minuten −5"><Icon.minus /></button>
      </div>
    </div>
  )
}
