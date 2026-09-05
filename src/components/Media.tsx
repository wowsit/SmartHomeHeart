import { useEffect, useRef, useState } from 'react'
import { config } from '../config'
import { resolveHaUrl, useEntity, useHa } from '../ha/useHa'
import { Icon } from './Icons'
import { useNow } from '../hooks/useNow'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function MediaPlayer({ large = false, compact = false }: { large?: boolean; compact?: boolean }) {
  const ha = useHa()
  const m = useEntity(config.mediaPlayer)
  const now = useNow(1000)
  const [vol, setVol] = useState(0)
  const dragging = useRef(false)
  useEffect(() => { if (m && !dragging.current) setVol(Math.round((m.attributes.volume_level ?? 0) * 100)) }, [m])

  if (!m) return <div className="card media"><div className="empty">Player nicht gefunden ({config.mediaPlayer})</div></div>
  const a = m.attributes
  const playing = m.state === 'playing'
  const idle = ['off', 'idle', 'standby', 'unavailable'].includes(m.state)
  let pos = a.media_position ?? 0
  if (playing && a.media_position_updated_at) pos += (now.getTime() - new Date(a.media_position_updated_at).getTime()) / 1000
  const dur = a.media_duration ?? 0
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0
  const call = (service: string, data: Record<string, any> = {}) => ha.callService('media_player', service, { entity_id: m.entity_id, ...data })
  const art = a.entity_picture ? (a.entity_picture.startsWith('http') ? a.entity_picture : `${resolveHaUrl() ?? ''}${a.entity_picture}`) : null

  if (compact) {
    return (
      <div className="card media compact">
        <div className="art">{art ? <img src={art} alt="" /> : <Icon.music size={32} />}</div>
        <div className="media-info">
          <div className="media-title">{idle ? 'Nichts spielt' : a.media_title ?? '–'}</div>
          <div className="media-artist">{idle ? a.friendly_name : a.media_artist ?? a.media_album_name ?? ''}</div>
        </div>
        <button className="round" onClick={() => call('media_play_pause')} aria-label="Play/Pause">{playing ? <Icon.pause size={28} /> : <Icon.play size={28} />}</button>
        <button className="round" onClick={() => call('media_next_track')} aria-label="Weiter"><Icon.next /></button>
      </div>
    )
  }

  return (
    <div className={`card media ${large ? 'large' : ''}`}>
      <div className="media-top">
        <div className="art">{art ? <img src={art} alt="" /> : <Icon.music size={large ? 96 : 44} />}</div>
        <div className="media-info">
          <div className="media-title">{idle ? 'Nichts spielt' : a.media_title ?? '–'}</div>
          <div className="media-artist">{idle ? a.friendly_name : a.media_artist ?? a.media_album_name ?? ''}</div>
          {large && !idle && <div className="muted small">{a.media_album_name}</div>}
        </div>
      </div>
      {dur > 0 && (
        <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /><span className="progress-time">{fmt(pos)} / {fmt(dur)}</span></div>
      )}
      <div className="media-ctrl">
        <button className="round" onClick={() => call('media_previous_track')} aria-label="Zurück"><Icon.prev /></button>
        <button className="round primary" onClick={() => call('media_play_pause')} aria-label="Play/Pause">{playing ? <Icon.pause size={34} /> : <Icon.play size={34} />}</button>
        <button className="round" onClick={() => call('media_next_track')} aria-label="Weiter"><Icon.next /></button>
      </div>
      <div className="volume">
        <Icon.volume size={26} />
        <input type="range" className="slider" min={0} max={100} value={vol}
          onPointerDown={() => { dragging.current = true }}
          onChange={(e) => setVol(Number(e.target.value))}
          onPointerUp={(e) => { dragging.current = false; call('volume_set', { volume_level: Number((e.target as HTMLInputElement).value) / 100 }) }}
          aria-label="Lautstärke" />
        <span className="vol-num">{vol}</span>
      </div>
    </div>
  )
}

/** Schnellstart: startet eine Playlist/Radio in Music Assistant auf dem konfigurierten Player. */
export function QuickPlay() {
  const ha = useHa()
  const [busy, setBusy] = useState<string | null>(null)
  if (!config.musicQuickPlay.length) return null
  const start = async (q: (typeof config.musicQuickPlay)[number]) => {
    setBusy(q.name)
    try {
      await ha.callService('music_assistant', 'play_media', {
        entity_id: config.mediaPlayer,
        media_id: q.mediaId,
        media_type: q.mediaType,
        enqueue: 'replace',
        radio_mode: q.radio,
      })
    } finally {
      setTimeout(() => setBusy(null), 1500)
    }
  }
  return (
    <div className="card quickplay">
      <div className="card-title">Schnellstart</div>
      <div className="quickplay-grid">
        {config.musicQuickPlay.map((q) => (
          <button key={q.name} className={`quick-btn ${busy === q.name ? 'busy' : ''}`} onClick={() => start(q)}>
            <Icon.music size={26} />
            <span>{q.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
