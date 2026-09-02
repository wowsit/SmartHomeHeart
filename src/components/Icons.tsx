import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 28, props: P) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...props,
})
const I = (d: string) => ({ size, ...p }: P) => <svg {...base(size, p)}><path d={d} /></svg>

export const Icon = {
  home: I('M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z'),
  grid: I('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'),
  calendar: I('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4'),
  music: I('M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'),
  bulb: I('M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z'),
  power: I('M12 3v9M18.4 6.6a8 8 0 1 1-12.8 0'),
  thermo: I('M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0zM12 9v9'),
  play: I('M7 4v16l13-8z'),
  pause: I('M7 4h4v16H7zM13 4h4v16h-4z'),
  chevL: I('M15 5l-7 7 7 7'),
  chevR: I('M9 5l7 7-7 7'),
  prev: I('M19 20 9 12l10-8zM5 4v16'),
  next: I('M5 4l10 8-10 8zM19 4v16'),
  volume: I('M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13'),
  minus: I('M5 12h14'),
  close: I('M6 6l12 12M18 6 6 18'),
  bell: I('M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0'),
  shift: I('M12 4l8 9h-5v7H9v-7H4z'),
  backspace: I('M9 5h12v14H9l-6-7zM12 9l6 6M18 9l-6 6'),
  plus: I('M12 5v14M5 12h14'),
  wifi: I('M2 8.5a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01'),
  wifiOff: I('M2 2l20 20M2 8.5a15 15 0 0 1 5.6-3.3M22 8.5a15 15 0 0 0-8.5-4.1M5 12.5a10 10 0 0 1 3.3-2.3M19 12.5a10 10 0 0 0-3-2M8.5 16a5 5 0 0 1 7 0M12 20h.01'),
  sun: I('M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'),
  moon: I('M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z'),
  cloud: I('M17.5 19H7a4 4 0 1 1 .9-7.9A6 6 0 0 1 19.5 12a3.5 3.5 0 0 1-2 7z'),
  cloudSun: I('M12 3v1.5M5.6 5.6l1 1M3 12h1.5M8 8.5a4 4 0 0 1 7 1.5M18 20H8a3.5 3.5 0 1 1 .7-6.9A5 5 0 0 1 20 15a2.5 2.5 0 0 1-2 5z'),
  rain: I('M17.5 15H7a4 4 0 1 1 .9-7.9A6 6 0 0 1 19.5 8a3.5 3.5 0 0 1-2 7zM8 18v3M12 18v3M16 18v3'),
  snow: I('M17.5 15H7a4 4 0 1 1 .9-7.9A6 6 0 0 1 19.5 8a3.5 3.5 0 0 1-2 7zM8 19h.01M12 21h.01M16 19h.01M10 21h.01M14 19h.01'),
  storm: I('M17.5 14H7a4 4 0 1 1 .9-7.9A6 6 0 0 1 19.5 7a3.5 3.5 0 0 1-2 7zM13 13l-2 4h3l-2 4'),
  fog: I('M17.5 13H7a4 4 0 1 1 .9-7.9A6 6 0 0 1 19.5 6a3.5 3.5 0 0 1-2 7zM5 17h14M7 21h10'),
  wind: I('M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8a2 2 0 1 1-2 2'),
  drop: I('M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'),
  scene: I('M12 3l2.2 5.3 5.8.5-4.4 3.8 1.3 5.7L12 15.3l-4.9 3 1.3-5.7L4 8.8l5.8-.5z'),
}

export function WeatherIcon({ condition, size = 48 }: { condition: string; size?: number }) {
  const map: Record<string, keyof typeof Icon> = {
    'sunny': 'sun', 'clear-night': 'moon', 'partlycloudy': 'cloudSun', 'cloudy': 'cloud', 'rainy': 'rain', 'pouring': 'rain',
    'snowy': 'snow', 'snowy-rainy': 'snow', 'lightning': 'storm', 'lightning-rainy': 'storm', 'fog': 'fog', 'windy': 'wind', 'windy-variant': 'wind', 'hail': 'snow', 'exceptional': 'cloud',
  }
  const C = Icon[map[condition] ?? 'cloud']
  return <C size={size} />
}

export const conditionLabel: Record<string, string> = {
  'sunny': 'Sonnig', 'clear-night': 'Klar', 'partlycloudy': 'Teils bewölkt', 'cloudy': 'Bewölkt', 'rainy': 'Regen', 'pouring': 'Starkregen',
  'snowy': 'Schnee', 'snowy-rainy': 'Schneeregen', 'lightning': 'Gewitter', 'lightning-rainy': 'Gewitter', 'fog': 'Nebel', 'windy': 'Windig', 'windy-variant': 'Windig', 'hail': 'Hagel', 'exceptional': 'Unwetter',
}
