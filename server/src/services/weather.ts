import path from 'node:path';
import type {
  WeatherDay,
  WeatherDetails,
  WeatherHour,
  WeatherIcon,
  WeatherSummary,
} from '../../../shared/types.ts';
import { SEEDS_DIR } from '../lib/paths.ts';
import { readJson } from '../lib/jsonStore.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';
import { addDays, startOfDay, toDateKey } from '../lib/dates.ts';
import { loadConfig } from './config.ts';

/**
 * Wetterquelle ist Open-Meteo: kein API-Key, keine Registrierung, kein
 * Cloud-Zwang beim Setup. Faellt der Abruf aus (Pi offline), greifen die
 * Seed-Daten, damit die Karte nie leer bleibt.
 */
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 60_000;

let cache: { at: number; data: WeatherSummary } | null = null;

/** WMO-Wettercode → Icon + deutsche Beschreibung. */
const WMO: Record<number, { icon: WeatherIcon; text: string }> = {
  0: { icon: 'clear', text: 'Klar' },
  1: { icon: 'clear', text: 'Überwiegend klar' },
  2: { icon: 'partly', text: 'Wechselnd bewölkt' },
  3: { icon: 'cloudy', text: 'Bedeckt' },
  45: { icon: 'fog', text: 'Nebel' },
  48: { icon: 'fog', text: 'Reifnebel' },
  51: { icon: 'drizzle', text: 'Leichter Nieselregen' },
  53: { icon: 'drizzle', text: 'Nieselregen' },
  55: { icon: 'drizzle', text: 'Starker Nieselregen' },
  56: { icon: 'drizzle', text: 'Gefrierender Niesel' },
  57: { icon: 'drizzle', text: 'Gefrierender Niesel' },
  61: { icon: 'rain', text: 'Leichter Regen' },
  63: { icon: 'rain', text: 'Regen' },
  65: { icon: 'rain', text: 'Starker Regen' },
  66: { icon: 'rain', text: 'Gefrierender Regen' },
  67: { icon: 'rain', text: 'Gefrierender Regen' },
  71: { icon: 'snow', text: 'Leichter Schneefall' },
  73: { icon: 'snow', text: 'Schneefall' },
  75: { icon: 'snow', text: 'Starker Schneefall' },
  77: { icon: 'snow', text: 'Schneegriesel' },
  80: { icon: 'rain', text: 'Regenschauer' },
  81: { icon: 'rain', text: 'Kräftige Schauer' },
  82: { icon: 'rain', text: 'Heftige Schauer' },
  85: { icon: 'snow', text: 'Schneeschauer' },
  86: { icon: 'snow', text: 'Starke Schneeschauer' },
  95: { icon: 'thunder', text: 'Gewitter' },
  96: { icon: 'thunder', text: 'Gewitter mit Hagel' },
  99: { icon: 'thunder', text: 'Schweres Gewitter' },
};

function describeCode(code: number): { icon: WeatherIcon; text: string } {
  return WMO[code] ?? { icon: 'cloudy', text: 'Unbekannt' };
}

interface SeedWeather {
  temperature: number;
  apparentTemperature: number;
  description: string;
  icon: WeatherIcon;
  high: number;
  low: number;
  windSpeed: number;
  humidity: number;
  precipitationChance: number;
  forecast: Array<{
    dayOffset: number;
    min: number;
    max: number;
    icon: WeatherIcon;
    description: string;
    precipitationChance: number;
  }>;
}

/**
 * Stundenverlauf fuer den Fallback erzeugen.
 *
 * Ein Sinus ueber den Tag mit Tiefpunkt am fruehen Morgen — realistisch genug,
 * damit das Detailfenster auch ohne Internet sinnvoll aussieht.
 */
function seedHourly(seed: SeedWeather, from: Date): WeatherHour[] {
  const span = (seed.high - seed.low) / 2;
  const mid = (seed.high + seed.low) / 2;

  return Array.from({ length: HOURLY_WINDOW }, (_, offset) => {
    const time = new Date(from.getTime() + offset * 3600_000);
    const hourOfDay = time.getHours() + time.getMinutes() / 60;
    // Tiefpunkt gegen 5 Uhr, Hoechstwert gegen 17 Uhr.
    const curve = -Math.cos(((hourOfDay - 5) / 24) * Math.PI * 2);
    const temperature = round(mid + curve * span);

    return {
      time: time.toISOString(),
      temperature,
      apparent: round(temperature - 1.2),
      precipitationChance: Math.max(
        0,
        Math.round(seed.precipitationChance + Math.sin(offset / 3) * 18),
      ),
      windSpeed: Math.max(0, Math.round(seed.windSpeed + Math.sin(offset / 4) * 5)),
      icon: seed.icon,
    };
  });
}

/** Sonnenauf- und -untergang grob schaetzen, wenn keine echten Daten vorliegen. */
function seedSun(day: Date): { sunrise: string; sunset: string } {
  const rise = new Date(day);
  rise.setHours(6, 30, 0, 0);
  const set = new Date(day);
  set.setHours(20, 15, 0, 0);
  return { sunrise: rise.toISOString(), sunset: set.toISOString() };
}

async function seedWeather(locationName: string): Promise<WeatherSummary> {
  const seed = await readJson<SeedWeather>(path.join(SEEDS_DIR, 'weather.json'));
  const today = startOfDay(new Date());
  const hour = new Date().getHours();
  const sun = seedSun(new Date());

  if (!seed) {
    return {
      locationName,
      temperature: 0,
      apparentTemperature: 0,
      description: 'Keine Wetterdaten',
      icon: 'cloudy',
      high: 0,
      low: 0,
      windSpeed: 0,
      humidity: 0,
      precipitationChance: 0,
      isDay: hour >= 7 && hour < 21,
      forecast: [],
      hourly: [],
      details: {
        pressure: 0,
        cloudCover: 0,
        windDirection: 0,
        windGusts: 0,
        precipitation: 0,
        uvIndexMax: 0,
        sunrise: sun.sunrise,
        sunset: sun.sunset,
      },
      updatedAt: new Date().toISOString(),
      source: 'seed',
    };
  }

  return {
    locationName,
    temperature: seed.temperature,
    apparentTemperature: seed.apparentTemperature,
    description: seed.description,
    icon: seed.icon,
    high: seed.high,
    low: seed.low,
    windSpeed: seed.windSpeed,
    humidity: seed.humidity,
    precipitationChance: seed.precipitationChance,
    isDay: hour >= 7 && hour < 21,
    forecast: seed.forecast.map((day): WeatherDay => {
      const date = addDays(today, day.dayOffset);
      const daySun = seedSun(date);
      return {
        date: toDateKey(date),
        min: day.min,
        max: day.max,
        icon: day.icon,
        description: day.description,
        precipitationChance: day.precipitationChance,
        precipitationSum: round((day.precipitationChance / 100) * 4.5),
        uvIndexMax: day.icon === 'clear' ? 5.4 : 2.8,
        windGusts: 28,
        sunrise: daySun.sunrise,
        sunset: daySun.sunset,
      };
    }),
    hourly: seedHourly(seed, new Date()),
    details: {
      pressure: 1014,
      cloudCover: seed.icon === 'clear' ? 12 : 78,
      windDirection: 235,
      windGusts: Math.round(seed.windSpeed * 1.8),
      precipitation: 0,
      uvIndexMax: seed.icon === 'clear' ? 5.4 : 2.8,
      sunrise: sun.sunrise,
      sunset: sun.sunset,
    },
    updatedAt: new Date().toISOString(),
    source: 'seed',
  };
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
    pressure_msl?: number;
    cloud_cover?: number;
    precipitation?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    apparent_temperature?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    uv_index_max?: number[];
    wind_gusts_10m_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
}

/** Wie viele Stunden der Verlauf im Detailfenster abdeckt. */
const HOURLY_WINDOW = 24;

export async function getWeather(force = false): Promise<WeatherSummary> {
  const config = await loadConfig();
  const { locationName, latitude, longitude, timezone } = config.weather;

  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: timezone || 'auto',
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,' +
      'wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,precipitation,is_day',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,' +
      'precipitation_sum,uv_index_max,wind_gusts_10m_max,sunrise,sunset',
    forecast_days: '7',
  });

  try {
    const response = await fetchWithTimeout(`${OPEN_METEO_URL}?${params}`, {}, 8_000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = (await response.json()) as OpenMeteoResponse;
    const current = data.current ?? {};
    const daily = data.daily ?? {};
    const codeInfo = describeCode(current.weather_code ?? 3);

    const forecast: WeatherDay[] = (daily.time ?? []).map((date, i) => {
      const info = describeCode(daily.weather_code?.[i] ?? 3);
      return {
        date,
        min: round(daily.temperature_2m_min?.[i] ?? 0),
        max: round(daily.temperature_2m_max?.[i] ?? 0),
        icon: info.icon,
        description: info.text,
        precipitationChance: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
        precipitationSum: round(daily.precipitation_sum?.[i] ?? 0),
        uvIndexMax: round(daily.uv_index_max?.[i] ?? 0),
        windGusts: Math.round(daily.wind_gusts_10m_max?.[i] ?? 0),
        sunrise: daily.sunrise?.[i],
        sunset: daily.sunset?.[i],
      };
    });

    // Der Stundenverlauf beginnt bei der aktuellen Stunde, nicht um Mitternacht.
    const hourlySource = data.hourly ?? {};
    const times = hourlySource.time ?? [];
    const nowMs = Date.now();
    const firstIndex = Math.max(
      0,
      times.findIndex((entry) => new Date(entry).getTime() >= nowMs - 3600_000),
    );

    const hourly: WeatherHour[] = times
      .slice(firstIndex, firstIndex + HOURLY_WINDOW)
      .map((time, offset) => {
        const i = firstIndex + offset;
        return {
          time,
          temperature: round(hourlySource.temperature_2m?.[i] ?? 0),
          apparent: round(hourlySource.apparent_temperature?.[i] ?? 0),
          precipitationChance: Math.round(hourlySource.precipitation_probability?.[i] ?? 0),
          windSpeed: Math.round(hourlySource.wind_speed_10m?.[i] ?? 0),
          icon: describeCode(hourlySource.weather_code?.[i] ?? 3).icon,
        };
      });

    const details: WeatherDetails = {
      pressure: Math.round(current.pressure_msl ?? 0),
      cloudCover: Math.round(current.cloud_cover ?? 0),
      windDirection: Math.round(current.wind_direction_10m ?? 0),
      windGusts: Math.round(current.wind_gusts_10m ?? 0),
      precipitation: round(current.precipitation ?? 0),
      uvIndexMax: round(daily.uv_index_max?.[0] ?? 0),
      sunrise: daily.sunrise?.[0] ?? '',
      sunset: daily.sunset?.[0] ?? '',
    };

    const summary: WeatherSummary = {
      locationName,
      temperature: round(current.temperature_2m ?? 0),
      apparentTemperature: round(current.apparent_temperature ?? 0),
      description: codeInfo.text,
      icon: codeInfo.icon,
      high: forecast[0]?.max ?? 0,
      low: forecast[0]?.min ?? 0,
      windSpeed: Math.round(current.wind_speed_10m ?? 0),
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      precipitationChance: forecast[0]?.precipitationChance ?? 0,
      isDay: current.is_day !== 0,
      forecast,
      hourly,
      details,
      updatedAt: new Date().toISOString(),
      source: 'open-meteo',
    };

    cache = { at: Date.now(), data: summary };
    return summary;
  } catch (error) {
    console.warn(`[weather] Open-Meteo nicht erreichbar (${describeError(error)}) — Seed-Daten.`);
    const fallback = await seedWeather(locationName);
    cache = { at: Date.now(), data: fallback };
    return fallback;
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function invalidateWeatherCache(): void {
  cache = null;
}
