import { accents, shadows } from './src/theme/tokens.js';

/**
 * Der Akzent kommt zur Laufzeit aus der CSS-Variablen `--accent`, damit der
 * Theme-Modus ohne Neubau umschaltbar bleibt. Die Werte aus tokens.js dienen
 * als Fallback und fuer feste Abstufungen.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Hoehenabhaengige Varianten: 1024x600 hat reichlich Breite, aber
        // sehr wenig Hoehe — dort muessen Polster und Kachelhoehen schrumpfen.
        short: { raw: '(max-height: 720px)' },
        tall: { raw: '(min-height: 900px)' },
      },
      /*
       * Alle Grautoene laufen ueber CSS-Variablen, damit Hell/Dunkel ohne
       * Neubau umschaltbar ist. Die ~450 vorhandenen Farbklassen im Code
       * bleiben unangetastet — sie folgen automatisch.
       *
       * `white` und `black` sind hier bewusst umdefiniert: Im Code kommen sie
       * ausschliesslich mit Transparenz vor (Haarlinien, Abdunklungen), nie
       * als reines Weiss. Im hellen Design muss eine Haarlinie dunkel sein.
       */
      colors: {
        surface: {
          900: 'rgb(var(--surface-900) / <alpha-value>)',
          800: 'rgb(var(--surface-800) / <alpha-value>)',
          700: 'rgb(var(--surface-700) / <alpha-value>)',
          600: 'rgb(var(--surface-600) / <alpha-value>)',
          500: 'rgb(var(--surface-500) / <alpha-value>)',
          400: 'rgb(var(--surface-400) / <alpha-value>)',
          300: 'rgb(var(--surface-300) / <alpha-value>)',
        },
        zinc: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        white: 'rgb(var(--hairline) / <alpha-value>)',
        black: 'rgb(var(--shade) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          hot: 'rgb(var(--accent-hot) / <alpha-value>)',
          dim: accents.ember.dim,
        },
        signal: {
          ok: 'rgb(var(--signal-ok) / <alpha-value>)',
          warn: 'rgb(var(--signal-warn) / <alpha-value>)',
          err: 'rgb(var(--signal-err) / <alpha-value>)',
          info: 'rgb(var(--signal-info) / <alpha-value>)',
          idle: 'rgb(var(--signal-idle) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        label: '0.22em',
        wide2: '0.14em',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.95rem' }],
        '3xs': ['0.625rem', { lineHeight: '0.85rem' }],
      },
      boxShadow: shadows,
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'pulse-soft': { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '1' } },
        'sweep': { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(400%)' } },
        'rise': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'panel-in': {
          from: { opacity: '0', transform: 'translateY(28px) scale(0.965)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'none' },
        },
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.8s ease-in-out infinite',
        'sweep': 'sweep 9s linear infinite',
        'rise': 'rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'panel-in': 'panel-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 260ms ease-out both',
        'slide-up': 'slide-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'spin-slow': 'spin-slow 26s linear infinite',
      },
    },
  },
  plugins: [],
};
