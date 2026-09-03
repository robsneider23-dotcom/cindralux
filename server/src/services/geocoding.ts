import type { GeoResult } from '../../../shared/types.ts';
import { fetchWithTimeout, describeError } from '../lib/http.ts';

/**
 * Ortssuche über die Open-Meteo-Geocoding-API.
 *
 * Dieselbe Quelle wie das Wetter, ebenfalls ohne API-Key. Auch die
 * Rückwärtssuche läuft darüber: Der Browser liefert nur Koordinaten, für einen
 * lesbaren Ortsnamen braucht es den nächstgelegenen Treffer.
 */

const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';

interface GeoApiEntry {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
  timezone?: string;
  population?: number;
}

function toResult(entry: GeoApiEntry): GeoResult {
  return {
    name: entry.name ?? 'Unbekannt',
    latitude: entry.latitude ?? 0,
    longitude: entry.longitude ?? 0,
    country: entry.country ?? '',
    admin: entry.admin1,
    timezone: entry.timezone ?? 'Europe/Berlin',
    population: entry.population,
  };
}

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const params = new URLSearchParams({
    name: term,
    count: '8',
    language: 'de',
    format: 'json',
  });

  try {
    const response = await fetchWithTimeout(`${SEARCH_URL}?${params}`, {}, 8_000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { results?: GeoApiEntry[] };
    return (data.results ?? []).map(toResult);
  } catch (error) {
    console.warn(`[geo] Ortssuche fehlgeschlagen: ${describeError(error)}`);
    return [];
  }
}

/**
 * Koordinaten in einen Ortsnamen übersetzen.
 *
 * Open-Meteo bietet keine echte Rückwärtssuche. Deshalb wird der Ort über die
 * Zeitzone eingegrenzt und dann der geografisch nächste Treffer gewählt — für
 * die Standortanzeige eines Dashboards genau genug.
 */
export async function describeCoordinates(
  latitude: number,
  longitude: number,
): Promise<GeoResult | null> {
  // Ein grober Suchbegriff aus der Region liefert Kandidaten; ohne Namen kann
  // die API nicht suchen, deshalb wird über die Zeitzone abgeglichen.
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    count: '1',
    language: 'de',
    format: 'json',
  });

  try {
    // Der offizielle Weg ohne Suchbegriff: die Wetter-API liefert die Zeitzone,
    // der Name kommt aus einer Umkreissuche von BigDataCloud (kein Schlüssel).
    const response = await fetchWithTimeout(
      `https://api-bdc.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=de`,
      {},
      8_000,
    );

    if (response.ok) {
      const data = (await response.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
      };
      const name = data.city || data.locality;
      if (name) {
        return {
          name,
          latitude,
          longitude,
          country: data.countryName ?? '',
          admin: data.principalSubdivision,
          timezone: 'auto',
        };
      }
    }
  } catch (error) {
    console.warn(`[geo] Rückwärtssuche fehlgeschlagen: ${describeError(error)}`);
  }

  // Ohne Namen bleiben immerhin die Koordinaten brauchbar.
  void params;
  return {
    name: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
    latitude,
    longitude,
    country: '',
    timezone: 'auto',
  };
}
