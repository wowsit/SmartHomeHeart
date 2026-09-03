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
  const [st, setSt] = useState<AssistState>({ phase: 'idle' })
  const [armed, setArmed] = useState(false) // Mikro offen, lauscht aufs Wake Word

  useEffect(() => {
    let unsub = () => {}
    ha.getAssist().then((a) => {
      if (!a) return
      setAssist(a)
      unsub = a.subscribe(setSt)
      if (config.assistAutoStart) a.start().then(() => setArmed(true)).catch(() => {})
    })
    return () => unsub()
  }, [ha])

  const active = st.phase !== 'idle'

  const onTap = async () => {
    if (!assist) return
    if (active) { assist.stop(); setArmed(false); return }
    await assist.listenNow()
    setArmed(true)
  }

  return (
    <>
      <div className={`assist-dim ${active ? 'on' : ''}`} onPointerDown={() => assist?.stop()} />
      <div className={`assist ${active ? 'on' : ''} ${st.phase}`}>
        {active && (
          <div className="assist-bubble">
            <div className="assist-name">{config.assistName}</div>
            {st.phase === 'listening' && <div className="assist-status"><Waves /> Ich höre zu …</div>}
            {st.heard && <div className="assist-heard">„{st.heard}“</div>}
            {st.phase === 'thinking' && <div className="assist-status"><Dots /></div>}
            {st.answer && <div className="assist-answer">{st.answer}</div>}
            {st.phase === 'error' && <div className="assist-error">{st.error}</div>}
          </div>
        )}
        <button className={`assist-btn ${armed ? 'armed' : ''}`} onClick={onTap} aria-label="Sprachassistent">
          {active ? <Icon.close size={34} /> : <Icon.mic size={34} />}
        </button>
      </div>
    </>
  )
}

function Waves() {
  return <span className="waves"><i /><i /><i /><i /><i /></span>
}
function Dots() {
  return <span className="dots"><i /><i /><i /></span>
}
