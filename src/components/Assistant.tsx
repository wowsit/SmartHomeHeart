import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHa } from '../ha/useHa'
import type { AssistLike, AssistState } from '../ha/types'
import { Icon } from './Icons'

/**
 * Sprachassistent „Haus“ auf dem Dashboard.
 * Ruhezustand: kleiner Mikro-Button unten rechts. Wake Word (oder Antippen) → Hintergrund wird dunkel,
 * eine Sprechblase zeigt Zuhören / erkannten Satz / Antwort. Danach blendet alles wieder aus.
 */
export function Assistant() {
  const ha = useHa()
  const [assist, setAssist] = useState<AssistLike | null>(null)
  const [own, setOwn] = useState<AssistState>({ phase: 'idle' })       // Mikro des Dashboards
  const [remote, setRemote] = useState<AssistState>({ phase: 'idle' }) // Handy-App / Satelliten (aus HA)
  const [armed, setArmed] = useState(false) // Mikro offen, lauscht aufs Wake Word

  useEffect(() => {
    let unsub = () => {}
    ha.getAssist().then((a) => {
      if (!a) return
      setAssist(a)
      unsub = a.subscribe(setOwn)
      if (config.assistAutoStart) a.start().then(() => setArmed(true)).catch(() => {})
    })
    return () => unsub()
  }, [ha])
  useEffect(() => ha.subscribeAssistRuns(setRemote), [ha])

  // Eigener Lauf hat Vorrang; sonst das, was ein anderes Gerät gerade macht.
  // Ein eigener Fehler (z. B. kein Mikrofon im Browser) bleibt klein am Button – er darf weder den Bildschirm dimmen noch Handy-Befehle verdecken.
  const ownActive = own.phase !== 'idle' && own.phase !== 'error'
  const st = ownActive ? own : remote
  const active = st.phase !== 'idle'

  const onTap = async () => {
    if (!assist) return
    if (ownActive) { assist.stop(); setArmed(false); return }
    await assist.listenNow()
    setArmed(true)
  }

  return (
    <>
      <div className={`assist-dim ${active ? 'on' : ''}`} onPointerDown={() => { if (ownActive) assist?.stop() }} />
      {active && <Captions st={st} />}
      <div className={`assist ${ownActive ? 'on' : ''} ${own.phase}`}>
        {own.phase === 'error' && !active && <div className="assist-error">{own.error}</div>}
        <button className={`assist-btn ${armed ? 'armed' : ''}`} onClick={onTap} aria-label="Sprachassistent">
          {ownActive ? <Icon.close size={34} /> : <Icon.mic size={34} />}
        </button>
      </div>
    </>
  )
}

/** Schriftgröße nach Textlänge: kurze Antworten riesig, lange noch lesbar (Bühne 1080 px breit). */
function fontFor(text: string, base: number) {
  const n = text.length
  if (n <= 40) return base
  if (n <= 90) return Math.round(base * 0.8)
  if (n <= 160) return Math.round(base * 0.64)
  if (n <= 260) return Math.round(base * 0.5)
  return Math.round(base * 0.4)
}

/** Live-Untertitel in der Bildschirmmitte: gehörter Satz, darunter die (gestreamte) Antwort – sehr groß. */
function Captions({ st }: { st: AssistState }) {
  return (
    <div className={`captions ${st.phase}`} aria-live="polite">
      <div className="captions-name">{config.assistName}{st.source === 'remote' ? ' · Handy' : ''}</div>
      {st.phase === 'listening' && <div className="captions-status"><Waves big /> Ich höre zu …</div>}
      {st.heard && <div className="captions-heard" style={{ fontSize: fontFor(st.heard, 64) }}>„{st.heard}“</div>}
      {st.phase === 'thinking' && !st.answer && <div className="captions-status"><Dots /></div>}
      {st.answer && <div className="captions-answer" style={{ fontSize: fontFor(st.answer, 104) }}>{st.answer}{st.phase === 'thinking' && <span className="caret" />}</div>}
      {st.phase === 'error' && <div className="captions-error">{st.error}</div>}
    </div>
  )
}

function Waves({ big }: { big?: boolean }) {
  return <span className={`waves ${big ? 'big' : ''}`}><i /><i /><i /><i /><i /></span>
}
function Dots() {
  return <span className="dots"><i /><i /><i /></span>
}
