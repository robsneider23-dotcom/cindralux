import { Heart } from "lucide-react";
import { useState } from "react";
import { LegalDialog } from "./LegalDialog";

const DONATE_URL = "https://www.paypal.com/donate/?hosted_button_id=XLHVSK6YUXPP2";

const DATENSCHUTZ = [
  "Cindralux läuft vollständig lokal auf diesem Raspberry Pi. Es gibt keinen Cloud-Dienst des Projekts und keine Telemetrie — nichts, was an den Entwickler übertragen wird.",
  "Alle Einstellungen, Zugangsdaten und Tokens liegen ausschließlich in data/config.json auf diesem Gerät und verlassen es nicht, außer im nächsten Punkt.",
  "Wer eigene Verbindungen einrichtet — Home Assistant, Google Kalender, Google Fotos, Wetterdienst —, tauscht damit direkt mit diesem jeweiligen Anbieter Daten aus, nach dessen eigener Datenschutzerklärung. Das Dashboard reicht diese Verbindungen nur durch, es wertet die Inhalte nicht selbst aus und leitet sie an niemand Drittes weiter.",
  "Wird ein Nutzer-Account (KI-Zusammenfassung o. Ä.) mit einem API-Schlüssel verbunden, gilt entsprechend die Datenschutzerklärung des jeweiligen Anbieters für die dort gesendeten Anfragen.",
];

const HAFTUNG = [
  "Cindralux ist ein privates Hobby-Projekt und wird ohne Gewähr bereitgestellt — ohne Garantie auf Fehlerfreiheit, ständige Verfügbarkeit oder Eignung für einen bestimmten Zweck.",
  "Angezeigte Inhalte (Wetter, Abholtermine, Kalendertermine, Sensorwerte) stammen von Drittanbietern oder eigenen Sensoren und können veraltet, unvollständig oder falsch sein. Für wichtige Termine — insbesondere Müllabholung — gilt im Zweifel immer die Originalquelle.",
  "Für Schäden, die aus der Nutzung oder Nichtverfügbarkeit dieses Dashboards entstehen, wird keine Haftung übernommen, soweit gesetzlich zulässig.",
];

/**
 * Fußzeile der Einstellungs-Sidebar: Hinweis zur Konfiguration, Datenschutz-
 * und Haftungstext als eigenes Fenster, ein kleiner Spenden-Link und das
 * Copyright. Bewusst als eigene, zustandslose Komponente ausgelagert — der
 * Dialog-State bleibt hier, statt SettingsPanel.tsx weiter zu verlängern.
 */
export function LegalFooter() {
  const [offen, setOffen] = useState<"datenschutz" | "haftung" | null>(null);

  return (
    <div className="mt-auto space-y-2.5 px-1 pb-1">
      <div className="text-3xs leading-relaxed text-zinc-700">
        Konfiguration liegt lokal in <span className="digits">data/config.json</span>.
        Tokens verlassen das Gerät nicht.
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-3xs">
        <button
          type="button"
          onClick={() => setOffen("datenschutz")}
          className="touchable text-zinc-600 underline-offset-2 active:text-accent-soft active:underline"
        >
          Datenschutz
        </button>
        <span className="text-zinc-800">·</span>
        <button
          type="button"
          onClick={() => setOffen("haftung")}
          className="touchable text-zinc-600 underline-offset-2 active:text-accent-soft active:underline"
        >
          Haftungsausschluss
        </button>
      </div>

      <a
        href={DONATE_URL}
        target="_blank"
        rel="noreferrer"
        className="touchable flex min-h-[34px] items-center justify-center gap-1.5 rounded-[3px] border border-accent/25 bg-accent/[0.06] text-3xs text-accent-soft active:bg-accent/[0.14]"
      >
        <Heart size={12} strokeWidth={2} />
        Projekt unterstützen
      </a>

      <div className="text-3xs text-zinc-800">
        © {new Date().getFullYear()} Cindralux
      </div>

      {offen === "datenschutz" && (
        <LegalDialog
          title="Datenschutzerklärung"
          paragraphs={DATENSCHUTZ}
          onClose={() => setOffen(null)}
        />
      )}
      {offen === "haftung" && (
        <LegalDialog
          title="Haftungsausschluss"
          paragraphs={HAFTUNG}
          onClose={() => setOffen(null)}
        />
      )}
    </div>
  );
}
