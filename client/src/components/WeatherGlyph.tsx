import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
  type LucideProps,
} from "lucide-react";
import type { WeatherIcon } from "@shared/types";

const GLYPHS: Record<WeatherIcon, React.ComponentType<LucideProps>> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  thunder: CloudLightning,
};

/** Farbe je Wetterlage — warm bei Sonne, kuehl bei Niederschlag. */
const COLORS: Record<WeatherIcon, string> = {
  clear: "#fbbf24",
  partly: "#facc15",
  cloudy: "#94a3b8",
  fog: "#94a3b8",
  drizzle: "#38bdf8",
  rain: "#38bdf8",
  snow: "#a5f3fc",
  thunder: "#a78bfa",
};

export function WeatherGlyph({
  icon,
  size = 24,
  strokeWidth = 1.25,
  colored = true,
  className,
}: {
  icon: WeatherIcon;
  size?: number;
  strokeWidth?: number;
  colored?: boolean;
  className?: string;
}) {
  const Glyph = GLYPHS[icon] ?? Cloud;
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      color={colored ? COLORS[icon] : undefined}
    />
  );
}

export function weatherColor(icon: WeatherIcon): string {
  return COLORS[icon] ?? "#94a3b8";
}
