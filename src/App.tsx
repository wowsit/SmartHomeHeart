import { useEffect, useMemo, useState } from 'react'
import { config } from './config'
import { createBackend, HaContext, useConnState, useEntities } from './ha/useHa'
import { Clock } from './components/Clock'
import { Weather } from './components/Weather'
import { Agenda, CalendarPage } from './components/Calendar'
import { MediaPlayer } from './components/Media'
import { RoomSummary, Scenes, SmarthomePage } from './components/Smarthome'
import { Icon } from './components/Icons'

type Page = 'home' | 'smarthome' | 'calendar' | 'music'
const NAV: { id: Page; label: string; icon: keyof typeof Icon }[] = [
  { id: 'home', label: 'Übersicht', icon: 'home' },
  { id: 'smarthome', label: 'Zuhause', icon: 'grid' },
  { id: 'calendar', label: 'Kalender', icon: 'calendar' },
  { id: 'music', label: 'Musik', icon: 'music' },
]

const PORTRAIT = config.orientation === 'portrait'
export const STAGE = PORTRAIT ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 }

/** Skaliert die feste Bühne (1080×1920 hochkant bzw. 1920×1080 quer) auf jede Fenstergröße – auf dem 27"-FHD-Display = 1:1. */
function useStageScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const f = () => setScale(Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h))
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f)
  }, [])
  return scale
}

function useIdle(seconds: number) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!seconds) return
    let t: ReturnType<typeof setTimeout>
    const reset = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), seconds * 1000) }
    const evs = ['pointerdown', 'pointermove', 'keydown', 'touchstart']
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, reset)) }
  }, [seconds])
  return idle
}

function ConnBadge() {
  const s = useConnState()
  const label = { connected: 'Verbunden', connecting: 'Verbinde…', disconnected: 'Getrennt', demo: 'Demo-Modus' }[s]
  return (
    <div className={`conn conn-${s}`} title={label}>
      {s === 'disconnected' ? <Icon.wifiOff size={24} /> : <Icon.wifi size={24} />}
      <span>{label}</span>
    </div>
  )
}

function HomePagePortrait() {
  const entities = useEntities()
  return (
    <div className="page home-portrait">
      <div className="row top">
        <div className="card"><Clock /></div>
        <Weather compact />
      </div>
      <Scenes />
      <div className="rooms">
        {config.rooms.map((r) => <RoomSummary key={r.name} room={r} entities={entities} />)}
      </div>
      <div className="row bottom">
        <Agenda />
        <MediaPlayer />
      </div>
    </div>
  )
}

function HomePage() {
  const entities = useEntities()
  if (PORTRAIT) return <HomePagePortrait />
  return (
    <div className="page home">
      <div className="col">
        <div className="card"><Clock /></div>
        <Weather />
      </div>
      <div className="col wide">
        <Scenes />
        <div className="rooms">
          {config.rooms.map((r) => <RoomSummary key={r.name} room={r} entities={entities} />)}
        </div>
      </div>
      <div className="col">
        <Agenda />
        <MediaPlayer />
      </div>
    </div>
  )
}

function Screensaver({ onWake }: { onWake: () => void }) {
  return (
    <div className="screensaver" onPointerDown={onWake}>
      <Clock big />
    </div>
  )
}

export default function App() {
  const ha = useMemo(createBackend, [])
  const scale = useStageScale()
  const [page, setPage] = useState<Page>('home')
  const idle = useIdle(config.screensaverAfter)
  const [woke, setWoke] = useState(false)
  useEffect(() => { if (!idle) setWoke(false) }, [idle])
  const kiosk = new URLSearchParams(location.search).get('kiosk') === '1'

  return (
    <HaContext.Provider value={ha}>
      <div className={`stage ${PORTRAIT ? 'portrait' : 'landscape'} ${kiosk ? 'kiosk' : ''}`}
        style={{ width: STAGE.w, height: STAGE.h, marginLeft: -STAGE.w / 2, marginTop: -STAGE.h / 2, transform: `scale(${scale})` }}>
        <nav className="nav">
          {NAV.map((n) => { const I = Icon[n.icon]; return (
            <button key={n.id} className={`nav-btn ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
              <I size={34} /><span>{n.label}</span>
            </button>
          ) })}
          <div className="nav-spacer" />
          <ConnBadge />
        </nav>
        <main className="main">
          {page === 'home' && <HomePage />}
          {page === 'smarthome' && <SmarthomePage />}
          {page === 'calendar' && <CalendarPage />}
          {page === 'music' && <div className="page music"><MediaPlayer large /></div>}
        </main>
        {idle && !woke && <Screensaver onWake={() => setWoke(true)} />}
      </div>
    </HaContext.Provider>
  )
}
