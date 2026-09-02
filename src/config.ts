/**
 * Dashboard-Konfiguration: welche HA-Entities wo angezeigt werden.
 * Im Demo-Modus (kein Token) existieren genau diese IDs als simulierte Geräte.
 * Für die echte HA-Instanz einfach die entity_ids anpassen.
 */
export interface RoomConfig {
  name: string
  entities: string[] // light.*, switch.*, climate.*
}

export const config = {
  weather: 'weather.home',
  calendars: ['calendar.familie', 'calendar.arbeit'],
  mediaPlayer: 'media_player.wohnzimmer',
  scenes: [
    { id: 'scene.gemuetlich', name: 'Gemütlich' },
    { id: 'scene.film', name: 'Filmabend' },
    { id: 'scene.alles_aus', name: 'Alles aus' },
    { id: 'scene.gute_nacht', name: 'Gute Nacht' },
  ],
  rooms: [
    { name: 'Wohnzimmer', entities: ['light.wohnzimmer_decke', 'light.wohnzimmer_stehlampe', 'climate.wohnzimmer'] },
    { name: 'Küche', entities: ['light.kueche_decke', 'light.kueche_arbeitsplatte', 'switch.kaffeemaschine'] },
    { name: 'Schlafzimmer', entities: ['light.schlafzimmer', 'light.nachttisch', 'climate.schlafzimmer'] },
    { name: 'Bad', entities: ['light.bad', 'switch.handtuchheizung'] },
    { name: 'Flur', entities: ['light.flur', 'switch.steckdose_flur'] },
    { name: 'Büro', entities: ['light.buero', 'switch.schreibtisch'] },
  ] as RoomConfig[],
  /** Sekunden ohne Berührung bis der Uhr-Bildschirmschoner erscheint (0 = aus) */
  /** Display-Ausrichtung: 'portrait' = 1080×1920 (Wandmontage hochkant), 'landscape' = 1920×1080 */
  orientation: 'portrait' as 'portrait' | 'landscape',
  screensaverAfter: 300,
}
