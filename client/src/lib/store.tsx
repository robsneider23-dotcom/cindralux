import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  CalendarEventsResponse,
  HomeAssistantStatus,
  ListsResponse,
  PublicAppConfig,
  SensorReading,
  TrashResponse,
  WeatherSummary,
} from '@shared/types';
import { api } from './api';
import { usePolling, type PollingState } from '@/hooks/usePolling';
import { accents, fontPairings, skins } from '@/theme/tokens.js';
import { deriveAccentShades, hexToRgbTriplet } from './utils';

/** Aktualisierungsintervalle — bewusst ruhig, das Panel laeuft rund um die Uhr. */
const INTERVAL = {
  calendar: 5 * 60_000,
  // Die Temperatur soll auf einen Blick aktuell wirken — deshalb Ausnahme von
  // der sonst ruhigen Taktung. Der Server-Cache in weather.ts ist gleich lang,
  // sonst bekaeme der Client trotzdem nur alle 10 Minuten neue Werte.
  weather: 60_000,
  trash: 30 * 60_000,
  homeAssistant: 20_000,
  sensors: 15_000,
  // Timer haben einen eigenen, schneller tickenden Kontext — siehe timersStore.tsx.
  // Einkaufsliste/Notizen aendern sich nur durch Bedienung am Panel selbst.
  lists: 15_000,
};

interface DashboardValue {
  config: PublicAppConfig | null;
  calendar: CalendarEventsResponse | null;
  weather: WeatherSummary | null;
  trash: TrashResponse | null;
  homeAssistant: HomeAssistantStatus | null;
  sensors: SensorReading[];
  lists: ListsResponse | null;
  /** Erstabruf laeuft noch — im UI klar von "keine Daten" zu trennen. */
  pending: {
    calendar: boolean;
    weather: boolean;
    trash: boolean;
  };
  errors: {
    calendar: string | null;
    weather: string | null;
    trash: string | null;
    homeAssistant: string | null;
    config: string | null;
  };
  reloadConfig: () => Promise<void>;
  reloadCalendar: () => Promise<void>;
  reloadWeather: () => Promise<void>;
  reloadTrash: () => Promise<void>;
  reloadHomeAssistant: () => Promise<void>;
  reloadSensors: () => Promise<void>;
  reloadLists: () => Promise<void>;
  /** Nach dem Speichern der Einstellungen: alles neu ziehen. */
  reloadAll: () => Promise<void>;
}

const DashboardContext = createContext<DashboardValue | null>(null);

// Panels abonnieren nur ihre Daten; Sensorabfragen sollen keinen Kalender zeichnen.
const ConfigContext = createContext<PublicAppConfig | null>(null);
const CalendarContext = createContext<PollingState<CalendarEventsResponse> | null>(null);
const WeatherContext = createContext<PollingState<WeatherSummary> | null>(null);
const TrashContext = createContext<PollingState<TrashResponse> | null>(null);

export const useDashboardConfig = () => useContext(ConfigContext);
export function useCalendarData() {
  const value = useContext(CalendarContext);
  if (!value) throw new Error('DashboardProvider fehlt');
  return value;
}
export function useWeatherData() {
  const value = useContext(WeatherContext);
  if (!value) throw new Error('DashboardProvider fehlt');
  return value;
}
export function useTrashData() {
  const value = useContext(TrashContext);
  if (!value) throw new Error('DashboardProvider fehlt');
  return value;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicAppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const reloadConfig = useCallback(async () => {
    try {
      setConfig(await api.getConfig());
      setConfigError(null);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  const calendar = usePolling(() => api.calendarEvents(), INTERVAL.calendar);
  const weather = usePolling(() => api.weather(), INTERVAL.weather);
  const trash = usePolling(() => api.trash(), INTERVAL.trash);
  const homeAssistant = usePolling(() => api.homeAssistantStatus(), INTERVAL.homeAssistant);
  const sensors = usePolling(() => api.sensors(), INTERVAL.sensors);
  const lists = usePolling(() => api.lists(), INTERVAL.lists);

  // Theme-Modus und Hintergrund-Deckkraft als CSS-Variablen setzen —
  // so wirkt eine Aenderung in den Einstellungen sofort und ohne Neuladen.
  useEffect(() => {
    if (!config) return;
    const root = document.documentElement;
    root.style.setProperty('--backdrop-opacity', String(config.appearance.backgroundOpacity));
    root.dataset.motion = config.appearance.reducedMotion ? 'reduced' : 'full';
  }, [config]);

  /*
   * Hell/Dunkel.
   *
   * Bei "auto" entscheidet der Sonnenstand, nicht die Uhr: Das Panel soll
   * dunkel werden, wenn es im Raum dunkel wird — und das verschiebt sich
   * uebers Jahr um Stunden. Die Zeiten liefert Open-Meteo mit der
   * Wettervorhersage, also ohne zusaetzliche Abfrage.
   *
   * Fehlen sie (Wetter noch nicht geladen, Demo-Modus), greift ersatzweise
   * das Nachtfenster aus den Einstellungen.
   */
  useEffect(() => {
    if (!config) return;
    const { colorScheme, night, skin: skinId } = config.appearance;
    const root = document.documentElement;
    const heute = weather.data?.forecast?.[0];

    /*
     * Design-Richtung (appearance.skin): ein festes Gesamtpaket, siehe
     * theme/skins.css und deren Kommentar. Bei aktivem Skin (alles ausser
     * "default") legt der Skin Hell/Dunkel, Akzent und Schrift komplett
     * fest — themeMode/fontPairing/colorScheme greifen dann nicht.
     */
    const skin = skinId && skinId !== 'default' ? skins[skinId as keyof typeof skins] : null;
    root.dataset.skin = skinId ?? 'default';

    const anwenden = () => {
      if (skin) {
        const hell = skin.mode === 'light';
        const neu = hell ? 'light' : 'dark';
        root.dataset.theme = neu;
        root.style.setProperty('--accent', hexToRgbTriplet(skin.accent.base));
        root.style.setProperty('--accent-soft', hexToRgbTriplet(skin.accent.soft));
        root.style.setProperty('--accent-hot', hexToRgbTriplet(skin.accent.hot));
        root.style.setProperty('--font-sans', skin.fontSans);
        root.style.setProperty('--font-mono', skin.fontMono);
        return;
      }

      let hell = colorScheme === 'light';
      if (colorScheme === 'auto') {
        const jetzt = new Date();
        const auf = heute?.sunrise ? new Date(heute.sunrise) : null;
        const unter = heute?.sunset ? new Date(heute.sunset) : null;

        if (auf && unter && !Number.isNaN(auf.getTime()) && !Number.isNaN(unter.getTime())) {
          hell = jetzt >= auf && jetzt < unter;
        } else {
          const stunde = jetzt.getHours();
          // Nachtfenster kann ueber Mitternacht laufen (z.B. 22 bis 6).
          const nacht =
            night.startHour <= night.endHour
              ? stunde >= night.startHour && stunde < night.endHour
              : stunde >= night.startHour || stunde < night.endHour;
          hell = !nacht;
        }
      }
      /*
       * Sanft ueberblenden statt hart umschalten.
       *
       * CSS-Uebergaenge helfen hier nicht: Aendert sich eine CSS-Variable,
       * interpoliert der Browser die davon abgeleiteten Farben nicht — die
       * Messung zeigte einen harten Sprung am Ende der Laufzeit. Die
       * View-Transitions-API blendet dagegen die gesamte Seite ueber, genau
       * dafuer ist sie gedacht.
       *
       * Nur beim echten Wechsel, nicht beim ersten Rendern: Sonst blendet der
       * Seitenaufbau ein.
       */
      const neu = hell ? 'light' : 'dark';
      const wechsel = Boolean(root.dataset.theme) && root.dataset.theme !== neu;
      const setzen = () => {
        root.dataset.theme = neu;
      };

      type MitUebergang = Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      const doc = document as MitUebergang;

      if (wechsel && typeof doc.startViewTransition === 'function') {
        doc.startViewTransition(setzen);
      } else {
        setzen();
      }

      /*
       * Der Akzent wird hier gesetzt, nicht im CSS: Inline-Styles schlagen
       * Stylesheets, und er haengt ohnehin vom gewaehlten Farbmodus ab.
       *
       * Im hellen Design ruecken alle drei Stufen nach unten. Das helle
       * Orange erreicht auf Weiss nur rund 2:1 Kontrast und ist damit
       * unlesbar; die dunkleren Abstufungen derselben Palette lesen sich
       * sauber, ohne den Charakter zu verlieren.
       */
      const palette =
        config.appearance.themeMode === 'custom'
          ? deriveAccentShades(config.appearance.customAccent || accents.ember.base)
          : (accents[config.appearance.themeMode] ?? accents.ember);
      root.style.setProperty('--accent', hexToRgbTriplet(hell ? palette.hot : palette.base));
      root.style.setProperty('--accent-soft', hexToRgbTriplet(hell ? palette.dim : palette.soft));
      root.style.setProperty('--accent-hot', hexToRgbTriplet(hell ? palette.dim : palette.hot));

      // Schriftpaarung — dieselbe CSS-Variablen-Technik wie beim Akzent, damit
      // ein Wechsel ohne Neubau greift. Fehlt eine Kennung (alte config.json
      // ohne fontPairing), foerdert der Fallback im var() selbst in
      // tailwind.config.js "Standard" zutage — hier reicht ein leerer String,
      // der die Variable einfach ungesetzt laesst.
      const schrift = fontPairings[config.appearance.fontPairing] ?? fontPairings.standard;
      root.style.setProperty('--font-sans', schrift.sans);
      root.style.setProperty('--font-mono', schrift.mono);
    };

    anwenden();
    if (colorScheme !== 'auto') return;
    const timer = window.setInterval(anwenden, 60_000);
    return () => window.clearInterval(timer);
  }, [config, weather.data]);

  const reloadAll = useCallback(async () => {
    await reloadConfig();
    await Promise.all([
      calendar.reload(),
      weather.reload(),
      trash.reload(),
      homeAssistant.reload(),
      sensors.reload(),
    ]);
  }, [reloadConfig, calendar.reload, weather.reload, trash.reload, homeAssistant.reload, sensors.reload]);

  const value = useMemo<DashboardValue>(
    () => ({
      config,
      calendar: calendar.data,
      weather: weather.data,
      trash: trash.data,
      homeAssistant: homeAssistant.data,
      sensors: sensors.data?.sensors ?? [],
      lists: lists.data,
      pending: {
        calendar: calendar.loading && calendar.data === null,
        weather: weather.loading && weather.data === null,
        trash: trash.loading && trash.data === null,
      },
      errors: {
        calendar: calendar.error,
        weather: weather.error,
        trash: trash.error,
        homeAssistant: homeAssistant.error,
        config: configError,
      },
      reloadConfig,
      reloadCalendar: calendar.reload,
      reloadWeather: weather.reload,
      reloadTrash: trash.reload,
      reloadHomeAssistant: homeAssistant.reload,
      reloadSensors: sensors.reload,
      reloadLists: lists.reload,
      reloadAll,
    }),
    [
      config,
      configError,
      calendar,
      weather,
      trash,
      homeAssistant,
      sensors,
      lists,
      reloadConfig,
      reloadAll,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      <ConfigContext.Provider value={config}>
        <CalendarContext.Provider value={calendar}>
          <WeatherContext.Provider value={weather}>
            <TrashContext.Provider value={trash}>{children}</TrashContext.Provider>
          </WeatherContext.Provider>
        </CalendarContext.Provider>
      </ConfigContext.Provider>
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard muss innerhalb von DashboardProvider stehen');
  return context;
}
