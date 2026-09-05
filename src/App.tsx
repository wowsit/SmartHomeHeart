import { useEffect, useMemo, useState } from 'react'
import { config } from './config'
import { createBackend, HaContext, useConnState, useEntities } from './ha/useHa'
import { Clock } from './components/Clock'
import { Weather } from './components/Weather'
import { CalendarPage, CalendarWidget } from './components/Calendar'
import { MediaPlayer, QuickPlay } from './components/Media'
import { LightsWidget, RoomSummary, SmarthomePage } from './components/Smarthome'
import { Icon } from './components/Icons'
import { Assistant } from './components/Assistant'

type Page = 'home' | 'smarthome' | 'calendar' | 'music'
const NAV: { id: Page; label: string; icon: keyof typeof Icon }[] = [
  { id: 'home', label: 'Übersicht', icon: 'home' },
  { id: 'smarthome', label: 'Zuhause', icon: 'grid' },
  { id: 'music', label: 'Musik', icon: 'music' },
]

const PORTRAIT = config.orientation === 'portrait'
const STAGE = PORTRAIT ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 }

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

/** Verbindungsstatus: nur sichtbar, wenn etwas nicht stimmt (getrennt / Demo) – sonst kein Rauschen. */
function ConnBadge() {
  const s = useConnState()
  if (s === 'connected') return null
  const label = { connecting: 'Verbinde…', disconnected: 'Keine Verbindung zu Home Assistant', demo: 'Demo' }[s]
  return (
    <div className={`conn conn-${s}`}>
      {s === 'disconnected' && <Icon.wifiOff size={20} />}
      <span>{label}</span>
    </div>
  )
}

/** Always-on-Startseite: Uhr + Wetter, Kalender als Mittelpunkt, 4 Lichter, Musik */
function HomePagePortrait({ openCalendar }: { openCalendar: () => void }) {
  return (
    <div className="page home-portrait">
      <header className="hero">
        <Clock />
        <Weather compact />
      </header>
      <CalendarWidget onOpen={openCalendar} />
      <LightsWidget />
      <MediaPlayer compact />
    </div>
  )
}

function HomePage({ openCalendar }: { openCalendar: () => void }) {
  const entities = useEntities()
  if (PORTRAIT) return <HomePagePortrait openCalendar={openCalendar} />
  return (
    <div className="page home">
      <div className="col">
        <Clock />
        <Weather />
      </div>
      <div className="col wide">
        <div className="rooms">
          {config.rooms.map((r) => <RoomSummary key={r.name} room={r} entities={entities} />)}
        </div>
      </div>
      <div className="col">
        <CalendarWidget onOpen={openCalendar} />
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
  const ha = useMemo(() => createBackend(), [])
  const scale = useStageScale()
  const params = new URLSearchParams(location.search)
  const initial = (params.get('page') ?? (window as any).__PAGE__ ?? config.startPage) as Page
  const [page, setPage] = useState<Page>((NAV.some((n) => n.id === initial) || initial === 'calendar') ? initial : config.startPage)
  const idle = useIdle(config.screensaverAfter)
  const [woke, setWoke] = useState(false)
  if (!idle && woke) setWoke(false) // Reset beim Aufwachen – State-Anpassung im Render statt Effekt
  const kiosk = params.get('kiosk') === '1'

  return (
    <HaContext.Provider value={ha}>
      <div className={`stage ${PORTRAIT ? 'portrait' : 'landscape'} ${kiosk ? 'kiosk' : ''}`}
        style={{ width: STAGE.w, height: STAGE.h, marginLeft: -STAGE.w / 2, marginTop: -STAGE.h / 2, transform: `scale(${scale})` }}>
        <nav className="nav">
          {NAV.map((n) => { const I = Icon[n.icon]; return (
            <button key={n.id} className={`nav-btn ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
              <I size={30} /><span>{n.label}</span>
            </button>
          ) })}
          <div className="nav-spacer" />
          <ConnBadge />
        </nav>
        <main className="main">
          {page === 'home' && <HomePage openCalendar={() => setPage('calendar')} />}
          {page === 'smarthome' && <SmarthomePage />}
          {page === 'calendar' && <CalendarPage onBack={() => setPage('home')} />}
          {page === 'music' && <div className="page music"><MediaPlayer large /><QuickPlay /></div>}
        </main>
        <Assistant />
        {idle && !woke && <Screensaver onWake={() => { setWoke(true); setPage(config.startPage) }} />}
      </div>
    </HaContext.Provider>
  )
}
