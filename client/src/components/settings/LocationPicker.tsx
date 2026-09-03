import { Check, Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { useState } from "react";
import type { GeoResult, WeatherConfig } from "@shared/types";
import { api } from "@/lib/api";
import { cx } from "@/lib/utils";
import { Field } from "./SettingsControls";

/**
 * Standortwahl über Ortssuche oder das Gerät.
 *
 * Koordinaten von Hand einzutragen ist auf einem Touchpanel eine Zumutung —
 * deshalb Suche nach Ortsnamen (Open-Meteo Geocoding, kein Schlüssel nötig)
 * und ein Knopf, der den Standort vom Browser erfragt.
 */
export function LocationPicker({
  weather,
  onChange,
}: {
  weather: WeatherConfig;
  onChange: (patch: Partial<WeatherConfig>) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setMessage(null);
    try {
      const found = await api.searchPlaces(query);
      setResults(found);
      if (found.length === 0) setMessage("Kein Ort gefunden");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  };

  const apply = (place: GeoResult) => {
    onChange({
      locationName: place.name,
      latitude: Math.round(place.latitude * 10000) / 10000,
      longitude: Math.round(place.longitude * 10000) / 10000,
      timezone: place.timezone === "auto" ? weather.timezone : place.timezone,
    });
    setResults(null);
    setQuery("");
    setMessage(`Standort auf ${place.name} gesetzt`);
  };

  /** Standort vom Browser holen und in einen Ortsnamen übersetzen. */
  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("Dieser Browser kann den Standort nicht ermitteln");
      return;
    }

    setLocating(true);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const place = await api.reverseGeocode(
            position.coords.latitude,
            position.coords.longitude,
          );
          if (place) apply(place);
          else setMessage("Standort konnte keinem Ort zugeordnet werden");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Standortzugriff wurde abgelehnt"
            : "Standort konnte nicht ermittelt werden",
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 },
    );
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <Field
            label="Ort suchen"
            hint="Stadt oder Ortsteil eingeben, z. B. „Berlin“."
          >
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.8}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
                placeholder="Ortsname …"
                className="field pl-11"
              />
            </div>
          </Field>
        </div>

        <button
          type="button"
          onClick={() => void search()}
          disabled={searching || query.trim().length < 2}
          className="btn min-h-[52px] shrink-0 px-5"
        >
          {searching ? (
            <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Search size={15} strokeWidth={1.8} />
          )}
          Suchen
        </button>

        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="btn min-h-[52px] shrink-0 px-5"
          title="Standort vom Gerät übernehmen"
        >
          {locating ? (
            <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Crosshair size={15} strokeWidth={1.8} />
          )}
          Hier
        </button>
      </div>

      {message && <p className="mb-3 text-3xs text-zinc-500">{message}</p>}

      {results && results.length > 0 && (
        <div className="mb-4 space-y-1">
          {results.map((place) => {
            const active =
              Math.abs(place.latitude - weather.latitude) < 0.01 &&
              Math.abs(place.longitude - weather.longitude) < 0.01;
            return (
              <button
                key={`${place.name}-${place.latitude}-${place.longitude}`}
                type="button"
                onClick={() => apply(place)}
                className={cx(
                  "touchable flex w-full items-center gap-3 rounded-[3px] border px-3.5 text-left",
                  active
                    ? "border-accent/45 bg-accent/[0.1]"
                    : "border-white/[0.07] active:bg-white/[0.035]",
                )}
              >
                <MapPin
                  size={15}
                  strokeWidth={1.7}
                  className="shrink-0 text-zinc-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">
                    {place.name}
                  </span>
                  <span className="block truncate text-3xs text-zinc-600">
                    {[place.admin, place.country].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="digits shrink-0 text-3xs text-zinc-600">
                  {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
                </span>
                {active && (
                  <Check
                    size={15}
                    strokeWidth={2.2}
                    className="shrink-0 text-accent"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Aktueller Stand, weiterhin von Hand korrigierbar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Field label="Ort">
          <input
            value={weather.locationName}
            onChange={(event) => onChange({ locationName: event.target.value })}
            className="field"
          />
        </Field>
        <Field label="Breitengrad">
          <input
            type="number"
            step="0.0001"
            value={weather.latitude}
            onChange={(event) =>
              onChange({ latitude: Number(event.target.value) })
            }
            className="field digits"
          />
        </Field>
        <Field label="Längengrad">
          <input
            type="number"
            step="0.0001"
            value={weather.longitude}
            onChange={(event) =>
              onChange({ longitude: Number(event.target.value) })
            }
            className="field digits"
          />
        </Field>
        <Field label="Zeitzone">
          <input
            value={weather.timezone}
            onChange={(event) => onChange({ timezone: event.target.value })}
            className="field font-mono text-2xs"
          />
        </Field>
      </div>
    </>
  );
}
