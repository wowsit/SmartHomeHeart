/**
 * „Wake-Word anlernen“ (Einstellungen → Sprachassistent): führt Schritt für Schritt durch
 * Aufnahmen von „hey Haus“ – verschiedene Personen, Abstände, Lautstärken – plus Gegenbeispiele.
 * Jede Aufnahme wird angehört und mit „Fertig“ bestätigt, erst dann landet sie auf dem Pi
 * (`/wwrec/clip` → ~/wakeword-clips/<schritt>/). Aus diesen Clips trainiert Viktor die nächste
 * Wake-Word-Version; synthetische Stimmen allein reichten nicht (Trefferquote 0,475).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import { ClipRecorder, blobToBase64, type Recording } from '../ha/recorder'
import { lockMic } from '../ha/micLock'

interface Step {
  id: string
  who: string
  title: string
  hint: string
  target: number
  secs: number
}

/** Reihenfolge = Ablauf. Zusammen 50 Aufnahmen von Fynn, 30 von Emilia, 10 mit Geräusch, 6 Gegenbeispiele. */
const STEPS: Step[] = [
  { id: 'fynn_nah', who: 'Fynn', title: 'Nah, etwa 1 Meter', target: 10, secs: 2.2, hint: 'Ganz normal sprechen: „hey Haus“. Kurz warten, sprechen, kurz warten.' },
  { id: 'fynn_mittel', who: 'Fynn', title: 'Aus 3 Metern', target: 10, secs: 2.2, hint: 'Ein paar Schritte weg vom Display, dann „hey Haus“ in normaler Lautstärke.' },
  { id: 'fynn_leise', who: 'Fynn', title: 'Leise und nebenbei', target: 10, secs: 2.2, hint: 'Halblaut, genervt, gemurmelt – so wie abends auf dem Sofa.' },
  { id: 'fynn_schnell', who: 'Fynn', title: 'Schnell und mit Befehl', target: 10, secs: 2.6, hint: 'Schnell sprechen, gern direkt weiter: „hey Haus, mach das Licht an.“' },
  { id: 'fynn_frei', who: 'Fynn', title: 'Freie Runde', target: 10, secs: 2.4, hint: 'Kopf weggedreht, im Sitzen, aus dem Nebenraum, mit Betonung auf „Haus“ – Abwechslung hilft am meisten.' },
  { id: 'emilia_nah', who: 'Emilia', title: 'Nah, etwa 1 Meter', target: 10, secs: 2.2, hint: 'Emilia spricht: „hey Haus“, normal und deutlich.' },
  { id: 'emilia_mittel', who: 'Emilia', title: 'Aus 3 Metern', target: 10, secs: 2.2, hint: 'Emilia, ein paar Schritte entfernt.' },
  { id: 'emilia_frei', who: 'Emilia', title: 'Leise und frei', target: 10, secs: 2.4, hint: 'Emilia leise, schnell, nebenbei – gern auch mit Befehl dahinter.' },
  { id: 'geraeusch', who: 'Beide', title: 'Mit Nebengeräusch', target: 10, secs: 2.6, hint: 'Musik, Fernseher, Küche oder Wasserhahn an – dann „hey Haus“ rufen.' },
  { id: 'negativ', who: 'Gegenbeispiele', title: 'Alles, was NICHT auslösen soll', target: 6, secs: 8, hint: 'Acht Sekunden normal reden, Fernsehton, oder ähnliche Wörter: „Haus“, „heute“, „hey Hanna“. Kein „hey Haus“!' },
]

type Phase = 'ready' | 'countdown' | 'recording' | 'preview' | 'saving'

async function api(path: string, body?: unknown) {
  const res = await fetch(`/wwrec${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return (await res.json()) as { ok: boolean; error?: string; count?: number; counts?: Record<string, number>; total?: number }
}

export function WakeWordSheet({ onClose }: { onClose: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [level, setLevel] = useState(0)
  const [clip, setClip] = useState<(Recording & { url: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<ClipRecorder>(new ClipRecorder())
  const step = STEPS[idx]
  const done = counts[step?.id] ?? 0
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const goal = STEPS.reduce((n, s) => n + s.target, 0)

  // Solange dieses Fenster offen ist, gehört das Mikrofon der Aufnahme, nicht dem Assistenten.
  useEffect(() => {
    const r = rec.current
    lockMic(true)
    api('/stats').then((res) => setCounts(res.counts ?? {})).catch(() => setError('Aufnahme-Dienst auf dem Pi nicht erreichbar.'))
    return () => { lockMic(false); r.close() }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const r = rec.current
      r.onLevel = setLevel
      await r.open()
      setPhase('countdown')
      await new Promise((res) => setTimeout(res, 800))
      setPhase('recording')
      const out = await r.record(step.secs)
      if (clip) URL.revokeObjectURL(clip.url)
      setClip({ ...out, url: URL.createObjectURL(out.blob) })
      setPhase('preview')
    } catch (e: any) {
      setPhase('ready')
      setError(e?.name === 'NotAllowedError' ? 'Kein Mikrofonzugriff – im Browser erlauben.' : String(e?.message ?? e))
    }
  }, [step, clip])

  const keep = async () => {
    if (!clip) return
    setPhase('saving')
    try {
      const r = await api('/clip', { step: step.id, wav_base64: await blobToBase64(clip.blob) })
      if (!r.ok) throw new Error(r.error ?? 'Speichern fehlgeschlagen')
      setCounts((c) => ({ ...c, [step.id]: r.count ?? (c[step.id] ?? 0) + 1 }))
      URL.revokeObjectURL(clip.url); setClip(null)
      setPhase('ready')
      if ((r.count ?? 0) >= step.target && idx < STEPS.length - 1) setIdx(idx + 1)
    } catch (e: any) {
      setError(String(e?.message ?? e))
      setPhase('preview')
    }
  }

  const again = () => { if (clip) URL.revokeObjectURL(clip.url); setClip(null); setPhase('ready') }

  const undo = async () => {
    const r = await api('/undo', { step: step.id })
    if (r.ok) setCounts((c) => ({ ...c, [step.id]: r.count ?? Math.max(0, (c[step.id] ?? 1) - 1) }))
    else setError(r.error ?? 'Nichts zu löschen')
  }

  const allDone = total >= goal
  const quiet = phase === 'preview' && clip !== null && clip.peak < 0.02

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Wake-Word anlernen</h2>
          <button className="round" onClick={onClose} aria-label="Schließen"><Icon.close /></button>
        </div>

        <div className="settings-scroll ww">
          <div className="ww-progress">
            <div className="ww-bar"><span style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} /></div>
            <div className="ww-count">{total} von {goal} Aufnahmen</div>
          </div>

          <section className="ww-step">
            <div className="ww-who">{step.who} · Schritt {idx + 1}/{STEPS.length}</div>
            <h3>{step.title} · {done}/{step.target}</h3>
            <p className="hint">{step.hint}</p>

            {phase === 'ready' && (
              <button className="cta ww-rec" onClick={start}>
                <Icon.mic size={30} /> Aufnehmen ({step.secs.toFixed(1)} s)
              </button>
            )}
            {phase === 'countdown' && <div className="ww-live">Gleich … bitte kurz still sein</div>}
            {phase === 'recording' && (
              <div className="ww-live rec">
                <span className="ww-dot" /> Sprich jetzt
                <div className="ww-level"><span style={{ width: `${Math.round(level * 100)}%` }} /></div>
              </div>
            )}
            {phase === 'saving' && <div className="ww-live">Speichere …</div>}
            {phase === 'preview' && clip && (
              <div className="ww-preview">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={clip.url} controls autoPlay />
                {quiet && <p className="hint warn">Sehr leise aufgenommen – lieber noch einmal.</p>}
                <div className="ww-actions">
                  <button className="pill" onClick={again}><Icon.close size={22} /> Nochmal</button>
                  <button className="cta grow" onClick={keep}><Icon.check size={24} /> Fertig</button>
                </div>
              </div>
            )}
            {error && <p className="hint warn">{error}</p>}
          </section>

          <section>
            <h3>Übersicht</h3>
            <div className="ww-list">
              {STEPS.map((s, i) => {
                const n = counts[s.id] ?? 0
                return (
                  <button key={s.id} className={`ww-item ${i === idx ? 'on' : ''} ${n >= s.target ? 'full' : ''}`} onClick={() => { setIdx(i); again() }}>
                    <span className="ww-item-title">{s.who} · {s.title}</span>
                    <span className="ww-item-count">{n}/{s.target}{n >= s.target && <Icon.check size={20} />}</span>
                  </button>
                )
              })}
            </div>
            <p className="hint">
              {allDone
                ? 'Alle Schritte voll – sag Viktor Bescheid, dann trainiert er die neue Version.'
                : 'Reihenfolge ist egal, du kannst jederzeit aufhören und später weitermachen. Die Aufnahmen bleiben auf dem Pi.'}
            </p>
          </section>
        </div>

        <div className="sheet-options">
          <button className="pill" onClick={undo}>Letzte löschen</button>
          <button className="pill" onClick={() => setIdx(Math.min(STEPS.length - 1, idx + 1))}>Schritt überspringen</button>
          <button className="cta grow" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  )
}
