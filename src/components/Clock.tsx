import { useEffect, useRef, useState } from 'react'
import { useNow } from '../hooks/useNow'

// Optischer Randausgleich: bei grossen Ziffern (v.a. "1") hat das Glyph links
// mehr Luft als der Textkasten -> das Datum wuerde optisch links herausstehen.
// Wir messen die linke Seitenluft der ersten Ziffer und ruecken das Datum
// um genau diesen Betrag ein, damit es buendig unter der Uhrzeit sitzt.
function useOpticalIndent(timeRef: React.RefObject<HTMLDivElement | null>, firstChar: string, enabled: boolean) {
  const [indent, setIndent] = useState(0)
  useEffect(() => {
    if (!enabled || !timeRef.current) { setIndent(0); return }
    try {
      const cs = getComputedStyle(timeRef.current)
      const ctx = document.createElement('canvas').getContext('2d')
      if (!ctx) return
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const m = ctx.measureText(firstChar)
      const bearing = -m.actualBoundingBoxLeft
      setIndent(Number.isFinite(bearing) && bearing > 0 ? bearing : 0)
    } catch {
      setIndent(0)
    }
  }, [enabled, firstChar, timeRef])
  return indent
}

export function Clock({ big = false, compact = false }: { big?: boolean; compact?: boolean }) {
  const now = useNow()
  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeRef = useRef<HTMLDivElement>(null)
  // nur beim linksbuendigen Layout ausgleichen (big = zentriert, compact = rechtsbuendig)
  const indent = useOpticalIndent(timeRef, time.charAt(0), !big && !compact)
  // Datum steht buendig unter der Uhrzeit – Wunsch 2026-09-05 (Sprachauftrag)
  return (
    <div className={`clock ${big ? 'clock-big' : ''} ${compact ? 'clock-compact' : ''}`}>
      <div className="clock-time" ref={timeRef}>{time}</div>
      <div className="clock-date" style={indent ? { paddingLeft: `${indent}px` } : undefined}>{date}</div>
    </div>
  )
}
