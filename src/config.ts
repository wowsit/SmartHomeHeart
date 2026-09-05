/**
 * Dashboard-Konfiguration: welche HA-Entities wo angezeigt werden.
 * Im Demo-Modus (kein Token) existieren genau diese IDs als simulierte Geräte.
 * Für die echte HA-Instanz einfach die entity_ids anpassen.
 */
export interface RoomConfig {
  name: string
  entities: string[] // light.*, switch.*, climate.*
}

export type CalColor = 'green' | 'blue' | 'orange' | 'purple' | 'pink' | 'grey'
export interface CalendarConfig {
  entity: string // HA calendar entity, z. B. calendar.max (Google/CalDAV/… läuft über HA)
  name: string
  color: CalColor
}

export const config = {
  /** Wetter-Entity aus HA. Der Standort (Sandkrug, Fichtenweg 10A, 26209 Hatten) wird in HA gesetzt: Einstellungen → System → Allgemein → Standort. */
  weather: 'weather.forecast_home', // Met.no, in HA vorhanden (Stand 2026-09-03)
  locationName: 'Sandkrug',
  /** Die wichtigsten Lichter für das Widget auf der Übersicht.
   *  Echte HA-Entities (Stand 2026-09-04): beide Lampen hängen an Schaltsteckdosen, sind also `switch.*`
   *  (kein Dimmen). `switch.licht_wohnen` ist die HA-Helfer-Gruppe aus beiden. */
  lights: [
    { entity: 'switch.licht_wohnen', name: 'Licht Wohnen' },
    { entity: 'switch.wohnzimmer', name: 'Wohnzimmer' },
    { entity: 'switch.esszimmer', name: 'Esszimmer' },
  ] as { entity: string; name?: string }[],
  /** Kalender-Entities aus Home Assistant. Reihenfolge = Reihenfolge in der Legende. */
  calendars: [
    // iCloud über HA-CalDAV (Entities aus HA, Stand 2026-09-03). 'calendar.untitled' ist leer und bewusst nicht gelistet.
    { entity: 'calendar.hjem', name: 'Hjem', color: 'green' },
    { entity: 'calendar.arbeid', name: 'Arbeid', color: 'blue' },
    // Zweiter iCloud-Account (vt92@gmx.de, CalDAV-Eintrag seit 2026-09-03) – alle pink (Wunsch). 'Schule' etc. sind dort Erinnerungslisten (todo.*), keine Kalender.
    { entity: 'calendar.kalender', name: 'Kalender', color: 'pink' },
    { entity: 'calendar.arbeit', name: 'Arbeit', color: 'pink' },
    { entity: 'calendar.privat', name: 'Privat', color: 'pink' },
    { entity: 'calendar.familie', name: 'Familie', color: 'pink' },
  ] as CalendarConfig[],
  /** Music Assistant (HomeDeb, 192.168.178.154:8095) spielt Apple Music auf die Bluetooth-Box B06+ am Pi.
   *  Der HA-Player kommt aus der Music-Assistant-Integration (Squeezelite-Player "Wohnzimmer-B06", Stand 2026-09-05).
   *  Der LG-TV bleibt außen vor: er unterstützt kein play_media. */
  mediaPlayer: 'media_player.wohnzimmer_b06',
  /** Schnellstart-Kacheln auf der Musik-Seite. `mediaId` wird von Music Assistant in Apple Music gesucht.
   *  `radio` = danach endlos in ähnlicher Musik weiterlaufen (Endless Mix). */
  musicQuickPlay: [
    { name: 'Entspannt', mediaId: 'Chill Hits', mediaType: 'playlist', radio: true },
    { name: 'Charts', mediaId: 'Top 100 Deutschland', mediaType: 'playlist', radio: false },
    { name: 'Rock', mediaId: 'Rock Classics', mediaType: 'playlist', radio: true },
    { name: 'Fokus', mediaId: 'Focus', mediaType: 'playlist', radio: true },
  ] as { name: string; mediaId: string; mediaType: 'playlist' | 'track' | 'artist' | 'album'; radio: boolean }[],
  /** In HA sind noch keine Szenen angelegt (scenes.yaml leer) – daher leer statt Platzhalter. */
  scenes: [] as { id: string; name: string }[],
  rooms: [
    { name: 'Wohnzimmer', entities: ['switch.wohnzimmer'] },
    { name: 'Esszimmer', entities: ['switch.esszimmer'] },
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
