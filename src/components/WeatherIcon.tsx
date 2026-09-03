import { Icon } from './Icons'

export function WeatherIcon({ condition, size = 48 }: { condition: string; size?: number }) {
  const map: Record<string, keyof typeof Icon> = {
    'sunny': 'sun', 'clear-night': 'moon', 'partlycloudy': 'cloudSun', 'cloudy': 'cloud', 'rainy': 'rain', 'pouring': 'rain',
    'snowy': 'snow', 'snowy-rainy': 'snow', 'lightning': 'storm', 'lightning-rainy': 'storm', 'fog': 'fog', 'windy': 'wind', 'windy-variant': 'wind', 'hail': 'snow', 'exceptional': 'cloud',
  }
  const C = Icon[map[condition] ?? 'cloud']
  return <C size={size} />
}
