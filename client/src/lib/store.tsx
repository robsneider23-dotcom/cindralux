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
  TimerListResponse,
  TrashResponse,
  WeatherSummary,
} from '@shared/types';
import { api } from './api';
import { usePolling } from '@/hooks/usePolling';
import { accents } from '@/theme/tokens.js';
import { hexToRgbTriplet } from './utils';

/** Aktualisierungsintervalle — bewusst ruhig, das Panel laeuft rund um die Uhr. */
const INTERVAL = {
  calendar: 5 * 60_000,
  weather: 10 * 60_000,
  trash: 30 * 60_000,
  homeAssistant: 20_000,
  sensors: 15_000,
  // Timer muessen sekundengenau klingeln — hier ist haeufiges Fragen der Zweck.
  timers: 2_000,
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
  timers: TimerListResponse | null;
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
  reloadTimers: () => Promise<void>;
  reloadLists: () => Promise<void>;
  /** Nach dem Speichern der Einstellungen: alles neu ziehen. */
  reloadAll: () => Promise<void>;
}

const DashboardContext = createContext<DashboardValue | null>(null);

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
  const timers = usePolling(() => api.timers(), INTERVAL.timers);
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
    const { colorScheme, night } = config.appearance;
    const root = document.documentElement;
    const heute = weather.data?.forecast?.[0];

    const anwenden = () => {
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
      const palette = accents[config.appearance.themeMode] ?? accents.ember;
      root.style.setProperty('--accent', hexToRgbTriplet(hell ? palette.hot : palette.base));
      root.style.setProperty('--accent-soft', hexToRgbTriplet(hell ? palette.dim : palette.soft));
      root.style.setProperty('--accent-hot', hexToRgbTriplet(hell ? palette.dim : palette.hot));
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
  }, [reloadConfig, calendar, weather, trash, homeAssistant, sensors]);

  const value = useMemo<DashboardValue>(
    () => ({
      config,
      calendar: calendar.data,
      weather: weather.data,
      trash: trash.data,
      homeAssistant: homeAssistant.data,
      sensors: sensors.data?.sensors ?? [],
      timers: timers.data,
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
      reloadTimers: timers.reload,
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
      timers,
      lists,
      reloadConfig,
      reloadAll,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard muss innerhalb von DashboardProvider stehen');
  return context;
}
