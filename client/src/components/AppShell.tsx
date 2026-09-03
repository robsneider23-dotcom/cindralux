import { useEffect, useState, type ReactNode } from "react";
import { StatusHeader } from "./StatusHeader";
import { SettingsPanel } from "./SettingsPanel";
import { RubiconBackground } from "./RubiconBackground";
import { NightOverlay } from "./NightOverlay";
import { TimerOverlay } from "./TimerOverlay";
import { useNightMode } from "@/hooks/useNightMode";
import { useIdle } from "@/hooks/useIdle";
import { IdleScreen } from "./idle/IdleScreen";
import { useDashboard } from "@/lib/store";
import { unlockAudio } from "@/lib/chime";
import { TouchKeyboard } from "./TouchKeyboard";
import { useOnScreenKeyboard } from "@/hooks/useOnScreenKeyboard";

/**
 * Rahmen der Anwendung: Hintergrundebene, Statusleiste, Inhalt und das
 * Einstellungs-Overlay. Der Rahmen selbst scrollt nie — im Kiosk-Modus muss
 * das Bild stehen.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { config } = useDashboard();
  const { idle, wake } = useIdle(
    config?.idle.enabled ?? false,
    config?.idle.afterSeconds ?? 120,
  );
  const tastatur = useOnScreenKeyboard(config?.appearance.onScreenKeyboard);
  const night = useNightMode(
    config?.appearance.night,
    config?.appearance.burnInProtection ?? false,
  );

  // Browser erlauben Ton erst nach einer Nutzerinteraktion. Auf einem
  // Touch-Panel wird ohnehin getippt — die erste Berührung schaltet ihn frei,
  // damit ein Timer später auch ohne Geste klingeln darf.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, {
      once: true,
      passive: true,
    });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  /*
   * Langes Tippen öffnet auf einem Touchscreen das Kontextmenü des Browsers.
   * Im Kiosk-Modus liegt es dann über dem Dashboard und lässt sich ohne Maus
   * nur schwer wieder schließen. In Eingabefeldern bleibt es erlaubt — dort
   * ist Einfügen die einzige bequeme Art, eine lange Adresse einzutragen.
   */
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
    };

    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return (
    <div
      className="relative flex h-full flex-col gap-2.5 overflow-hidden p-2.5"
      // Einbrennschutz: sehr langsamer Versatz um wenige Pixel.
      style={{
        transform: `translate(${night.shift.x}px, ${night.shift.y}px)`,
        transition: "transform 4s linear",
        // Platz für die Bildschirmtastatur freihalten, statt sie darüberzulegen.
        paddingBottom: "calc(0.625rem + var(--osk-height))",
      }}
    >
      <RubiconBackground />
      <StatusHeader onOpenSettings={() => setSettingsOpen(true)} />
      <main className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5">
        {children}
      </main>

      {idle && <IdleScreen onWake={wake} />}
      <NightOverlay night={night} />
      <TimerOverlay />
      <TouchKeyboard aktiv={tastatur} />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
