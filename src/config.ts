/**
 * Dashboard-Konfiguration: welche HA-Entities wo angezeigt werden.
 * Im Demo-Modus (kein Token) existieren genau diese IDs als simulierte Geräte.
 * Für die echte HA-Instanz einfach die entity_ids anpassen.
 */
export interface RoomConfig {
  name: string
  entities: string[] // light.*, switch.*, climate.*
}

export type CalColor = 'green' | 'blue' | 'orange' | 'purple' | 'grey'
export interface CalendarConfig {
  entity: string // HA calendar entity, z. B. calendar.max (Google/CalDAV/… läuft über HA)
  name: string
  color: CalColor
}

export const config = {
  /** Wetter-Entity aus HA. Der Standort (Sandkrug, Fichtenweg 10A, 26209 Hatten) wird in HA gesetzt: Einstellungen → System → Allgemein → Standort. */
  weather: 'weather.forecast_home', // Met.no, in HA vorhanden (Stand 2026-09-03)
  locationName: 'Sandkrug',
  /** Die 4 wichtigsten Lichter für das Widget auf der Übersicht.
   *  TODO: In HA gibt es noch keine light-, media_player- oder scene-Entities (nur Home-Connect-Ofen) – IDs unten sind Platzhalter. */
  lights: [
    { entity: 'light.wohnzimmer_decke', name: 'Wohnzimmer' },
    { entity: 'light.kueche_decke', name: 'Küche' },
    { entity: 'light.flur', name: 'Flur' },
    { entity: 'light.schlafzimmer', name: 'Schlafzimmer' },
  ] as { entity: string; name?: string }[],
  /** Kalender-Entities aus Home Assistant. Reihenfolge = Reihenfolge in der Legende. */
  calendars: [
    // iCloud über HA-CalDAV (Entities aus HA, Stand 2026-09-03). 'calendar.untitled' ist leer und bewusst nicht gelistet.
    { entity: 'calendar.hjem', name: 'Hjem', color: 'green' },
    { entity: 'calendar.arbeid', name: 'Arbeid', color: 'blue' },
  ] as CalendarConfig[],
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
  /** Seite nach dem Start / nach dem Bildschirmschoner */
  startPage: 'home' as 'home' | 'smarthome' | 'music',
  screensaverAfter: 300,
  /** Sprachassistent: Assist-Pipeline-ID aus HA (leer = bevorzugte Pipeline). Wake Word läuft in HA (openWakeWord). */
  assistPipeline: '',
  /** Name, der in der Sprechblase steht */
  assistName: 'Haus',
  /** Beim Start automatisch aufs Wake Word lauschen (Kiosk). Im Browser am Mac erst nach Antippen des Mikro-Buttons. */
  assistAutoStart: true,
}
