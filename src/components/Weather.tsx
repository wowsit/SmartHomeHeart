import { useEffect, useState } from 'react'
import { config } from '../config'
import { useEntity, useHa } from '../ha/useHa'
import type { ForecastDay } from '../ha/types'
import { Icon, WeatherIcon, conditionLabel } from './Icons'

export function Weather({ compact = false }: { compact?: boolean }) {
  const ha = useHa()
  const w = useEntity(config.weather)
  const [forecast, setForecast] = useState<ForecastDay[]>([])

  useEffect(() => {
    let alive = true
    const load = () => ha.getForecast(config.weather).then((f) => alive && setForecast(f.slice(0, compact ? 4 : 5))).catch(console.error)
    load()
    const t = setInterval(load, 30 * 60 * 1000)
    return () => { alive = false; clearInterval(t) }
  }, [ha, compact])

  if (!w) return <div className="weather"><div className="muted">Wetter: keine Daten ({config.weather})</div></div>

  const a = w.attributes
  return (
    <div className={`weather ${compact ? 'compact' : 'card'}`}>
      <div className="weather-now">
        <WeatherIcon condition={w.state} size={compact ? 64 : 96} />
        <div>
          <div className="weather-temp">{Math.round(a.temperature)}°</div>
          <div className="weather-cond">{conditionLabel[w.state] ?? w.state}</div>
        </div>
        {!compact && (
          <div className="weather-meta">
            <span><Icon.drop size={22} /> {a.humidity}%</span>
            <span><Icon.wind size={22} /> {Math.round(a.wind_speed)} {a.wind_speed_unit ?? 'km/h'}</span>
          </div>
        )}
      </div>
      <div className="forecast">
        {forecast.map((f) => (
          <div key={f.datetime} className="forecast-day">
            <div className="forecast-name">{new Date(f.datetime).toLocaleDateString('de-DE', { weekday: compact ? 'short' : 'long' })}</div>
            <WeatherIcon condition={f.condition} size={compact ? 32 : 40} />
            <div className="muted forecast-cond">{conditionLabel[f.condition] ?? f.condition}</div>
            <div className="forecast-temps"><b>{Math.round(f.temperature)}°</b> <span className="muted">{Math.round(f.templow)}°</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}
