# CINDRALUX — Home Command Center

*[Deutsch](README.md) · [English](README.en.md)*

> 🚧 **Actively developed.** Runs stably day-to-day on a real Pi, but new
> features keep landing and structure/API may still shift. Not "finished" in
> the sense that nothing more is happening — see *Next steps* below for the
> current state.

A local touchscreen dashboard for a Raspberry Pi running Chromium in kiosk
mode: calendars from multiple sources, a clock, weather, trash pickup,
smart-home quick actions and an AI assistant — all on one screen, with no
cloud lock-in.

![Dashboard](docs/dashboard.png)

---

## Why Cindralux?

Family calendar hubs and smart displays with this feature set are usually
sold as hardware-plus-subscription products — pay once for the screen, then
pay again, forever, to keep the calendar syncing or the "premium" widgets
unlocked. Cindralux runs on a Raspberry Pi you already own (or a €40–80
one), is free and open-source, and every integration is opt-in: nothing
phones home unless you connect it yourself.

**A free, self-hosted alternative to paid hubs like:**

- **Skylight Calendar** — a $130+ family-calendar tablet with an optional
  monthly plan for extra features.
- **Hearth Display** — a wall-mounted family hub sold on a recurring
  subscription.
- **Google Nest Hub Max / Amazon Echo Show** — capable smart displays, but
  built around their makers' clouds, with some features gated behind their
  own subscriptions (Nest Aware, Alexa+).

**What ships in the box, ready to try immediately (no setup, no account):**
a realistic demo calendar, a weather fallback dataset, five placeholder
slideshow images, ten dashboard layout presets and five color-and-font
theme presets, a fully local shopping list/notes panel, and a WebAudio-based
timer/alarm system that needs no sound files.

**Where this is headed:** public-transport departures and commute time, and
a wake word for voice mode instead of a button press. See *Next steps* at
the bottom for the current state of each, and issues/PRs are welcome.

---

## Quick start

```bash
npm install          # installs client and server (npm workspaces)
npm run dev          # starts both: frontend :5173, backend :4000
```

> The `allowScripts` block in `package.json` grants esbuild its install
> script. npm 12+ blocks such scripts otherwise, and without esbuild neither
> Vite nor tsx will start.

Then open `http://localhost:5173`. The dashboard is immediately populated
with realistic demo data — nothing needs to be configured first.

### Run pieces individually

```bash
npm run dev:client   # Vite dev server only (:5173, proxies /api to :4000)
npm run dev:server   # Express API only (:4000)
```

### Production-like (one single process)

```bash
npm run build        # builds the frontend into client/dist
npm start            # Express serves both API and frontend on :4000
```

This is the mode meant for the Pi: one process, one port.

### Check

```bash
npm run typecheck    # TypeScript for client and server
```

---

## Project structure

```
client/     React 18 + Vite + TypeScript + Tailwind
  src/components/    dashboard panels
  src/theme/tokens.js  ← central theme file (colors, shadows, accents)
server/     Express + TypeScript (runs via tsx, no build step needed)
  src/services/      calendar, weather, trash, Home Assistant, AI
  src/routes/api.ts  all endpoints
shared/     types.ts — shared data model, types only
data/       config.json (runtime), seeds/ (demo data), cache/
assets/     cindralux/ — logo, watermark, backgrounds
```

`shared/types.ts` deliberately contains **types only**. That way every
`import type` reference is stripped during transpilation, and neither Vite
nor tsx ever need to resolve or bundle `/shared`.

---

## Configuration

Everything is adjustable through the **Settings panel** (gear icon, top
right). It's saved to `data/config.json` — that file is gitignored because it
holds tokens. It's created automatically with default values on first run.

Alternatively, via environment variable (wins over the file — handy for a
systemd unit on the Pi, without storing secrets in the JSON):

| Variable | Meaning |
| --- | --- |
| `HA_BASE_URL` / `HA_TOKEN` | Home Assistant |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | AI assistant |
| `PORT` | API port (default 4000) |
| `HOST` | bind address (default 127.0.0.1; remote access requires an SSH tunnel or authenticated HTTPS proxy; see [security](docs/security.md)) |

Secrets are never sent to the client — the API only reports `hasToken` or
`hasApiKey`. Leaving a field empty when saving keeps the existing value
unchanged; to actually clear it, the panel sends the sentinel `__clear__`.

---

## Integrations: what's real, what's mocked?

| Area | Status | Note |
| --- | --- | --- |
| **Weather** | **real** | Open-Meteo, no API key needed — including the hourly forecast, sunrise/sunset, wind, pressure and UV. Falls back to `data/seeds/weather.json` when offline, including for the detail view. |
| **Trash pickup** | **real** | Either your own rules (weekday + interval + anchor date) or your waste provider's ICS calendar, by address or file. |
| **Calendar** | **real, as soon as a URL is set** | ICS/iCal including recurring events, with a guided dialog for Google Calendar and grouping by account. Without a URL the source serves demo data from `data/seeds/calendar.json`. |
| **Home Assistant** | **wired up, mock by default** | Without a URL + token the dashboard shows simulated states. With configuration, the same calls go to the real REST API. |
| **AI assistant** | **wired up, local by default** | Without an API key the server answers questions from calendar, weather and trash data — real data, not placeholder text. With a key it talks to an OpenAI-compatible API. |
| **Voice mode** | **wired up, needs an OpenAI key** | Microphone conversation over the Realtime API (WebRTC). Only available with OpenAI. |
| **Sensor readings** | **real, once HA is connected** | Temperature, humidity, windows, power draw. Without HA, plausible sample values that follow a daily curve. |
| **Timers & alarms** | **real** | Fully local, independent of HA and AI. |
| **Photos (slideshow)** | **real** | A local photo folder always works; Google Photos optional via the picker (selection happens in Google's own window). |

### What you need to set up externally, for what — overview

None of this is required: with zero setup the dashboard runs immediately
with weather, trash pickup on your own rules, a demo calendar and local
photos. Every row below is an **optional** add-on.

| Feature | What's needed externally | Effort |
| --- | --- | --- |
| **Weather** | nothing — Open-Meteo, no key | none |
| **Trash pickup** | nothing (own rules) *or* your provider's ICS address/file | copy an address |
| **Calendar via iCal** | the private iCal address from Google/Nextcloud/iCloud/Outlook | copy an address |
| **Calendar via Google API** (recommended, near-live) | your own Google Cloud project + OAuth client | ~10 min, one-time — [docs/google-kalender.md](docs/google-kalender.md) *(German)* |
| **Google Photos in the slideshow** | the same Google Cloud project, with the Photos Picker API additionally enabled | ~2 min, one-time — [docs/google-fotos.md](docs/google-fotos.md) *(German)* |
| **Home Assistant** | a Long-Lived Access Token from your own HA instance | ~1 min |
| **AI assistant (text/briefing)** | optional: an API key from OpenAI or an OpenAI-compatible API (LM Studio/Ollama run with no internet at all) | a few minutes |
| **Voice mode (microphone)** | an OpenAI API key **with credit** — a ChatGPT Plus subscription does not unlock this | see below |
| **GPT Live** | nothing required (opens chatgpt.com in the browser); optionally a device command for kiosk use | none to a few minutes |
| **Donate button** | nothing — it's just a link | none |

All credentials stay exclusively local in `data/config.json` on this device
and are never sent to the browser.

### Connecting a calendar

#### Google Calendar via the API (recommended)

Under *Settings → Calendar → Google Calendar*, connect a Google account.
All of that account's calendars then appear for selection; tapping one adds
it to the dashboard.

Advantages over the iCal address: **near-live** instead of up to 24 hours of
delay, every calendar of an account visible at once, and Google resolves
recurring events itself via `singleEvents=true` — no RRULE handling needed
on this end.

The cost is a one-time Google Cloud project (about ten minutes). Step by
step: **[docs/google-kalender.md](docs/google-kalender.md)** *(German; an
English walkthrough of the same clicks is below)*.

Only `calendar.readonly` is requested — the dashboard can read events, not
change them. The client secret and refresh token stay local in
`data/config.json` and are never sent to the client.

**Quick English walkthrough** (same steps as the German doc):

1. Open [console.cloud.google.com](https://console.cloud.google.com), sign in
   with the Google account whose calendar you want to see, create a new
   project (e.g. `Cindralux Dashboard`).
2. Enable the **Google Calendar API** for that project (search for it, click
   **Enable**).
3. Under **APIs & Services → OAuth consent screen**: user type **External**,
   fill in app name and your email as support/developer contact, skip
   scopes, and under **Test users** add your own Google address — without
   this, Google later refuses sign-in with "access blocked". The app can
   stay in "Testing" status; that's enough (a test app's refresh token
   expires after seven days — publish the app once if that's inconvenient,
   no Google review is required as long as only you use it).
4. Under **APIs & Services → Credentials**, create an **OAuth client ID**,
   application type **Web application**, and add this exact redirect URI:
   `http://127.0.0.1:4000/api/google/callback` (adjust the port if your
   server runs elsewhere — the exact address is also shown in the dashboard
   right above the connect button).
5. In the dashboard: Settings → Calendar → paste **Client ID** and
   **Client secret**, save, then tap **Connect with Google**, choose the
   account, click through the "Google hasn't verified this app" warning
   (**Advanced → Go to Cindralux Dashboard**), and confirm calendar access.
6. Pick which of the account's calendars to show.

#### Google Calendar via the private iCal address (no Google project)

**Finding the link:**

> Google Calendar → select the calendar in the left-hand list →
> **Settings and sharing** → scroll down to **Integrate calendar** → copy the
> **Secret address in iCal format** field.

The address ends in `.ics`. Two mix-ups are common — the dashboard detects
both and tells you exactly what's wrong:

- the **web-interface** address (`…/calendar/u/0?cid=…`)
- the **embed** address (`…/calendar/embed?src=…`)

> ### This address is a secret
>
> Whoever has it can read your entire calendar — no login, no invitation
> needed. Treat it like a password:
>
> - **never commit it**, share it, or paste it into a ticket
> - don't show it in screenshots or logs
> - if you suspect it's leaked, click **Reset** in Google; the old address
>   becomes invalid immediately
>
> The dashboard holds up its end: the address is used **server-side only**
> and **never leaves the server**. The browser only learns *that* one is set,
> plus a harmless hint like `calendar.google.com/…/basic.ics`. Addresses are
> stripped from error messages and log lines before they're written, and the
> calendar cache stores only a one-way short hash instead of the address
> itself.

**Where to enter it** — two equivalent ways:

1. **In the dashboard**: gear icon → *Calendar* → paste the address into the
   source's field → *Save*. The field afterwards only shows
   `•••••••••• (set)`.
2. **In the file** `data/config.json`. The server notices changes to this
   file itself and reloads it — no restart needed.

```json
{
  "calendars": [
    {
      "id": "google-private",
      "name": "Private",
      "color": "#ff7a1a",
      "url": "YOUR_PRIVATE_ICS_URL",
      "enabled": true
    }
  ]
}
```

`data/config.json` is in `.gitignore` and holds your real data.
`data/config.example.json` sits next to it, has the same structure and only
placeholder values — that file belongs in the repo.

**Phase 1 uses ICS.** That's enough for a dashboard and needs no Google
project. The price is freshness: Google often takes hours to write new
events into the feed. If that's not acceptable, use the OAuth route above —
it's already built in and can be added at any time without the ICS sources
disappearing. Both run side by side.

#### More ICS sources

In Settings under *Calendar*, tap **Google Calendar**. The dialog walks you
through the exact click path in Google and validates the address before
adopting it: it fetches the feed once, confirms events are coming through,
and reads the calendar name straight from the file.

Calendars are grouped by **account** — several Google accounts (personal,
work) can run side by side. The account field is free text, purely for
grouping.

The check recognizes common mistakes and names them specifically: the embed
address, the web-interface address, and the public instead of the private
address each get their own hint instead of a generic error.

> **Two things worth knowing.**
> The private address acts like a password — whoever has it can read the
> calendar. It stays local in `data/config.json` and can be reset in Google
> at any time.
> Google also updates iCal feeds sluggishly: new or moved events can take up
> to 24 hours. That's a limitation of Google's, and the dashboard's refresh
> interval can't influence it. If you need near-live data, there's no way
> around Google OAuth — that would be a separate step.

#### Other sources

**Other ICS URL** accepts any iCal address — Nextcloud, iCloud, Outlook,
club or public-holiday calendars. `webcal://` is automatically rewritten to
`https://`.

The calendar service merges all active sources, resolves recurring events
(`RRULE`) including exceptions (`EXDATE`) and single-instance overrides
(`RECURRENCE-ID`), and corrects the daylight-saving shift that would
otherwise occur when expanding recurrences. The cache lives in
`data/cache/calendar.json`.

### Connecting Home Assistant

1. In Home Assistant: profile → security → generate a **Long-Lived Access
   Token**.
2. In Settings under *Connections*, enter the base URL and token.
3. Tap *Test Home Assistant*.

Tiles under *Appearance* reference `entity_id`s. A toggle tile calls
`turn_on`/`turn_off` depending on the current state; a scene tile fires
once.

### Calendar views

The calendar has three views, switchable in its header:

| View | Purpose |
| --- | --- |
| **Day** | A timeline with a fixed hourly grid (58 px per hour). Events sit at true scale, an ember line marks *now*. Arrow buttons page through days. |
| **Week** | The compact list of the next seven days — good for skimming. |
| **Month** | A grid calendar with colored event dots per day. Tapping a day jumps to the day view. |

Under *Settings → Calendar → View* you set which view is the **default view**
and after how many idle minutes the calendar **snaps back** to it (default 5
minutes, 0 disables it). Any interaction resets the timer — a panel in the
hallway shouldn't stay stuck on whatever view someone opened hours ago.

The day view deliberately uses a **pixel scale rather than percentages**: at
a percentage-based height a 15-minute event shrinks to a few pixels and its
title gets clipped. With a fixed scale, the day scrolls instead.

### Your waste provider's pickup calendar

Under *Settings → Trash & Weather → Pickup calendar* you can switch between
**your own rules** and **your provider's calendar**.

For the ICS route, either enter an address or upload an `.ics` file (for
providers that only offer a download). If an address is set, it takes
priority. The *Check* button fetches the calendar and reports how many
events and which bin types were found.

The bin type is recognized from the **event title** — providers name them
very differently ("Restmuell 2-woechentlich", "Restabfall", "Graue Tonne").
Keyword matching is used for this, with umlauts normalized first. Recognized
types: general waste, bio waste, paper, yellow-bag recycling, glass and
bulky waste; anything else keeps its original label.

The address is refetched at most every six hours — pickup calendars rarely
change.

### Choosing a location

Under *Settings → Trash & Weather → Weather location*:

- **Place search** via the Open-Meteo geocoding API (no key needed). Type a
  place name, pick from the results — coordinates and time zone are
  adopted automatically.
- **"Here"** asks the browser for the current location and translates it
  into a place name. Only works in a secure context (`localhost` or HTTPS),
  same as the microphone.
- Coordinates and time zone can also be corrected by hand.

### Weather detail view

Tapping the weather card slides in a detail view, centered — with everything
that doesn't fit on the card:

- **24-hour forecast.** Temperature as a line, chance of rain as bars
  underneath. Deliberately **two stacked charts sharing one time axis**
  instead of a second y-axis: two quantities on different scales in one
  coordinate system are almost always misleading. Dragging across the chart
  shows the hourly values.
- Sunrise and sunset
- Wind with direction and gusts, humidity, air pressure, cloud cover, UV
  index (with WHO level) and precipitation amount
- A full week's outlook with temperature ranges on a shared scale

The chart colors (amber `#d97706`, blue `#0284c7`) were checked against the
dark surface: they sit in the correct brightness band for dark backgrounds
and stay clearly distinct under red-green and blue-yellow color-vision
deficiency (ΔE > 23). Both series are also labeled — color alone never
carries the meaning. The same values are also available to screen readers
as a table in the markup.

### Dashboard layout

Under *Settings → Appearance → Layout* you decide which panels the grid
shows and where they sit. Ten presets cover the common cases — each with a
small preview of the column split:

| Preset | For |
| --- | --- |
| **Standard** | today's agenda and trash on the left, calendar in the middle, weather on the right |
| **Big calendar** | wall-calendar style: the month gets nine of twelve columns |
| **Two columns** | just agenda and calendar, the calmest variant |
| **Agenda** | today's agenda large; calendar and weather as supporting cast |
| **Weather station** | weather up front, plus sensor readings from the house |
| **Smart home** | quick actions and sensor readings permanent instead of in a window |
| **Kitchen** | shopping list open, next to events and weather |
| **Calendar only** | full width for events, everything else in the taskbar |
| **Everything at a glance** | four narrow columns, dense, nothing needs tapping |
| **Assistant** | the AI assistant sits fixed on the right |

Pure mirror images of the same layout are deliberately not included —
"weather on the left instead of the right" isn't a distinct layout, it's
taste.

**Custom layout.** For finer control, choose *Custom* and assemble it
yourself: one to four columns, their widths, and for each of the eight
panels which column it sits in (or whether it disappears from the grid
entirely). Drag-and-drop is deliberately absent — on a hallway touch panel
that's a chore with greasy fingers; individual taps are enough instead.

The column widths always sum to twelve: widening one column takes width from
whichever other column is currently widest. An invalid grid simply can't
occur. Deselected panels aren't lost — Smart Home, sensor readings,
Assistant and the list still open from the taskbar.

### Taskbar: Smart Home, House, Assistant

These three no longer occupy permanent space; they open as windows above the
**taskbar** at the bottom on tap instead. That leaves noticeably more room up
top for the calendar and today's agenda — the things you read in passing,
without tapping anything.

The buttons show state at a glance: how many devices are on, how many sensor
readings are notable, whether an AI connection is configured. The timer
chips and the button to set a new timer run alongside, to the right.

All windows live in a **portal attached to `<body>`**: `position: fixed`
otherwise stops referring to the viewport once any ancestor carries a
`transform` — and that's exactly what burn-in protection does to the entire
surface.

### Sensor readings on the dashboard

Under *Settings → House* you can set up any number of readings that appear
as the **House bar** above the quick actions: temperatures, humidity, window
contacts, power draw, solar yield, presence.

The `entity_id` is **picked, not typed**: if Home Assistant is connected, the
app fetches the real entity list with current values and offers it as a
searchable list. Without a connection, a sample selection appears so
everything can still be set up in advance.

Binary states are made readable — depending on device class, `on` becomes
"open", "running" or "home". A reading in an alarm state (an open window)
gets an ember-colored edge and stands out immediately from across the room.

Five readings are active by default; more than that doesn't fit legibly
side by side at 1024×600. More are wired up and can be enabled.

### Timers & alarms

Fully local, no Home Assistant and no AI involved.

- **By touch:** the **+** on the right of the House bar. Timers via presets
  from 3 to 60 minutes, alarms with a time and weekdays.
- **By voice:** "set a timer for ten minutes", "wake me up on weekdays at a
  quarter to seven", "which timers are running?", "delete the pasta timer".
  The voice assistant is given four functions for this that it can call
  itself.
- Running timers count down as chips in the House bar, turning ember-colored
  in the final minute. An expired one announces itself **full-screen** with
  sound — a kitchen timer needs to be noticeable from across the room.

The alert tone is generated via WebAudio, so there's no audio file to load.
Browsers only allow sound after a user interaction; the first touch on the
panel unlocks it.

**Alarms you've set survive a restart** (`data/timers.json`); short timers
deliberately do not — they'd have expired by the time of a restart anyway.

### Photos for the slideshow

Ambient mode (see *Night dimming and burn-in protection*) can show a photo
slideshow between the clock and the daily overview. Under *Settings →
Idle mode → Photos* there are two sources, which can be mixed:

- **Local folder** (`data/photos/` by default, changeable). Just copy
  pictures into it — jpg, png, webp, avif, gif and svg are recognized. Works
  with no internet and no account; this is the reliable baseline.
- **Google Photos** via the **Picker API**. Tapping *Choose Google Photos*
  opens Google's own selection window; whatever gets selected and confirmed
  there is downloaded by the dashboard and stored as a regular file in the
  same folder. From then on a Google photo is indistinguishable from a local
  one as far as the slideshow is concerned — including the ability to
  deselect or reselect it individually.

  In 2025 Google discontinued automatic access to an entire library; the
  picker is the remaining path and requires a conscious selection in its own
  window on every import — no background sync of an album. The connection
  is the same one used for Google Calendar (one Google account, one OAuth
  client); setup: **[docs/google-fotos.md](docs/google-fotos.md)**
  *(German; English summary below)*.

  **Quick English summary:** enable the **Google Photos Picker API** in the
  same Google Cloud project used for the calendar (search for it in the
  Cloud Console, click **Enable** — consent screen and OAuth client are
  already in place if the calendar is already set up). If you'd connected
  Google before this feature existed, disconnect and reconnect once (under
  *Calendar → Google Calendar → Disconnect*, then *Connect with Google*
  again) so the refresh token picks up the added
  `photospicker.mediaitems.readonly` scope. Then, under *Appearance →
  Photos*, tap **Choose Google Photos**, select images in Google's window,
  confirm — the dashboard downloads them into the configured photo folder.

In both cases, the tile selection in Settings decides which photos the
slideshow actually shows — with nothing selected, all of them play.

**Crop.** A photo fills the screen via `object-fit: cover` — a plain center
crop unless told otherwise. "Choose crop" on each tile lets you drag a
bright frame, sized to the actual aspect ratio of the screen you're using
right now, over the photo; the slideshow then shows exactly what sat inside
the frame. Without a choice, it stays centered.

**Ken Burns.** The "Ken Burns" transition doesn't always pan the same way:
nine variants (eight directions in — including diagonals — plus one out)
rotate randomly with every photo change.

### Shopping list & notes

The **"List" button** in the taskbar opens a window with two tabs: shopping
list and notes. Both fully local (`data/lists.json`), no Home Assistant or
AI involved. The shopping list checks items off instead of deleting them
right away — only its own "Delete completed" button cleans up, so an
accidental tap never makes something vanish.

### Alexa

**Deliberately not integrated directly.** This dashboard talks exclusively
to Home Assistant. The path to Alexa runs through Home Assistant later on —
the Alexa Smart Home skill, HA automations, Node-RED or webhooks. That keeps
exactly one integration point instead of two parallel ones.

### AI assistant

Works with any server that understands `POST /chat/completions` in the
OpenAI format:

| Provider | Base URL |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| LM Studio | `http://localhost:1234/v1` |
| Ollama | `http://localhost:11434/v1` |

Calendar, weather and trash pickup are sent along as context, so the daily
briefing describes the actual situation.

### Two modes in the AI area

The assistant has a switch at the top:

**1. Cindralux Assistant** — the built-in panel: a text field, daily
briefing, "What's on today?", smart-home suggestions, timers by voice, and
the microphone button for voice mode. Uses an OpenAI-compatible API, or
answers from local data when no key is set.

**2. GPT Live** — a large button that opens chatgpt.com in **its own
window**.

> **Why not embedded?** chatgpt.com sets `frame-ancestors` /
> `X-Frame-Options`; an iframe gets blocked by the browser. There's no
> legitimate workaround for that, and unofficial login hacks were never on
> the table. A separate window is the honest way to do it.

Under *Settings → Connections → GPT Live* you configure **how** it opens:

| Mode | Behavior |
| --- | --- |
| **Browser window** (default) | `window.open` from the page. Works with no setup. If a popup blocker swallows the window, the UI says so. |
| **Command on the device** | The server launches a configured command, e.g. `brave --app=https://chatgpt.com`. The more reliable route in kiosk mode, since a popup there would otherwise land in the same full-screen window. |

For safety: the command comes **exclusively from `data/config.json`**, never
from the request — the client only triggers it. It's launched without a
shell, so that even a strange URL in the configuration can't trigger a
command chain.

### Voice mode (microphone)

The microphone button in the assistant panel starts a real conversation over
the **OpenAI Realtime API** — speech in, speech out, no detour through text.

> **A ChatGPT Plus or Pro subscription does not unlock the API.** The
> subscription and the API are separate products at OpenAI. Voice mode needs
> an API key from [platform.openai.com](https://platform.openai.com) with
> credit on it. Realtime audio costs roughly €0.50–1 per hour of
> conversation, depending on the model.

**How it works:** the server issues a short-lived client token (valid for a
few minutes), and the browser uses it to build its own WebRTC connection to
OpenAI. The actual API key never leaves the Pi. A server-side relay would be
the alternative, but it would route the audio stream through the Pi with no
security benefit and add latency — the decisive downside for a voice
conversation.

The assistant gets the same household data as context as the text chat, but
its own style instructions: short spoken sentences, no bullet lists, times
spoken naturally.

On top of the timer and alarm functions, it controls the devices configured
in `smartHomeActions` — "turn off the living room light", "movie mode on".
Which names exist is stated directly in the tool's description; the model
may only pick what's configured. Without configured actions, voice mode is
limited to timers and alarms.

Configurable under *Connections → Voice mode*: model, voice (10 voices to
choose from), and the transcription model for the running conversation
transcript.

**The microphone needs a secure context.** `http://localhost` counts as
secure; a LAN address like `http://192.168.1.50:4000` does **not** — the
browser blocks `getUserMedia` there. For access from a phone, either set up
HTTPS or start Chromium with
`--unsafely-treat-insecure-origin-as-secure=http://192.168.1.50:4000`.

In kiosk mode, `--use-fake-ui-for-media-stream` stops Chromium from asking
for microphone permission on every launch.

The Realtime API's endpoints are deliberately kept in configuration: OpenAI
moved them from Beta to GA, and the code tries both variants. That way a
future change can be followed without a code change.

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | status including placeholders for Pi system values |
| GET / PUT | `/api/config` | read / write configuration (secrets masked) |
| GET | `/api/calendar/events` | merged events (`?force=1` forces a refetch) |
| GET | `/api/google/status` | connection status of the Google account |
| GET | `/api/google/auth-url` | URL of the consent dialog |
| GET | `/api/google/callback` | redirect target of the OAuth flow |
| GET | `/api/google/calendars` | calendar list of the connected account |
| POST | `/api/google/disconnect` | disconnect |
| GET | `/api/photos` | all images in the folder, with selection state |
| GET | `/api/photos/active` | only the images selected for the slideshow |
| GET | `/api/photos/file/:name` | serve one image |
| POST | `/api/google/photos/session` | create a Google Photos picker session |
| GET | `/api/google/photos/session/:id` | poll whether a selection has been made in the picker window |
| POST | `/api/google/photos/session/:id/import` | download selected images and add them to the local library |
| DELETE | `/api/google/photos/session/:id` | cancel / clean up a picker session |
| POST | `/api/calendar/refresh` | reload all sources immediately |
| POST | `/api/calendar/validate` | validate an ICS address, read name and event count |
| GET | `/api/trash/next` | next pickup + upcoming dates |
| POST | `/api/trash/validate` | validate an ICS pickup calendar |
| GET | `/api/geo/search` | place search for the weather location |
| GET | `/api/geo/reverse` | translate coordinates into a place name |
| GET | `/api/weather` | current weather + 7-day forecast |
| GET | `/api/home-assistant/status` | connection and entity states |
| GET | `/api/home-assistant/entities` | entity list for the settings picker |
| GET | `/api/home-assistant/sensors` | processed sensor readings for the dashboard |
| POST | `/api/home-assistant/call-service` | service call (`domain`, `service`, `entityId`, `serviceData`) |
| POST | `/api/ai/chat` | free-form question to the assistant |
| POST | `/api/ai/daily-briefing` | daily briefing from calendar, weather, trash |
| POST | `/api/ai/realtime/session` | short-lived token for voice mode (incl. tools) |
| POST | `/api/ai/gpt-live/open` | opens ChatGPT in the browser or via a device command |
| GET / POST | `/api/timers` | read / create timers and alarms |
| POST | `/api/timers/:id/dismiss` | acknowledge ringing (alarms advance) |
| DELETE | `/api/timers/:id` | delete a timer or alarm |
| POST | `/api/test/{home-assistant,ai,realtime,calendar,weather}` | connection tests for the settings panel |

---

## Design

The interface is meant to feel like a control-room instrument, not a card
dashboard: hairline borders, inset shadows, ember corner ticks, fine
scanlines and procedural grain. Digits run tabular throughout, so the clock
never jitters.

**Central theme file:** `client/src/theme/tokens.js`. It's read by both
`tailwind.config.js` and the TypeScript code — colors, shadows, calendar
palette and background list exist in exactly one place.

The accent lives at runtime in the CSS variable `--accent`, so switching the
theme mode takes effect immediately, with no rebuild.

### Colors & typography

Under *Settings → Appearance → Colors & Typography*:

- **Eight accent colors** (Ember, Crimson, Graphite, Mint, Violet, Amber,
  Azurite, Rose) plus a **custom color** via a color picker — the four
  required shades (light/dark/bold) are computed from that one color via
  HSL.
- **Six font pairings** (Standard/Inter, Space Grotesk, Sora, Manrope,
  Public Sans, Outfit), selectable independently of the color.
- **Five ready-made presets** combine both with a single tap (e.g. Mint +
  Space Grotesk); color and font can still be adjusted individually
  afterwards.

Both run over CSS variables (`--font-sans`/`--font-mono`, same as `--accent`)
— a change applies immediately, with no reload.

### Night dimming and burn-in protection

Under *Settings → Appearance*:

- **Night dimming** darkens the panel during a configurable time window
  (default 22:00–06:00). Any touch wakes it to full brightness for a
  configurable duration. Optionally it shows **only the clock** at night —
  large, heavily dimmed, with the date and the next trash pickup, so no one
  needs to hunt for the dashboard in the dark.
- **Burn-in protection** shifts the interface by a few pixels every minute
  along two sine curves of different periods. A static dashboard would
  otherwise burn into many displays over time.

> Dimming darkens **the image** — the backlight itself can't be controlled
> from the browser. For actually turning the display off on the Pi:
> `xset dpms force off` via cron, or on newer systems
> `wlr-randr --output HDMI-A-1 --off`. That belongs in the Pi setup, not in
> the app.

### Touchscreen

- Every tappable surface is at least 46–64 px tall
- State is shown via `:active`, not `:hover`
- No text selection while swiping, no rubber-band scrolling
- The dashboard as a whole never scrolls — only individual panels scroll
  internally
- Settings appear as a full-screen overlay: no browser navigation needed

### Resolutions

Tested in landscape at **1024×600**, **1280×800** and **1920×1080**. Besides
the width breakpoints there's a height variant `short`
(`max-height: 720px`) that pulls back padding, tile heights and font sizes
on flat panels. At 1024×600 not everything fits at once — two deliberate
decisions apply there:

- The weather forecast collapses to **one compact row** instead of a
  temperature bar chart.
- The assistant loses its **text field** and keeps voice plus quick actions.
  On a 1024×600 touch panel the on-screen keyboard covers half the
  dashboard anyway.

### Custom Cindralux assets

Replace files in `assets/cindralux/` — keep the same filenames and nothing
in the code needs to change. Details and dimensions are in
`assets/cindralux/README.md`.

### Exiting the kiosk

Under *Settings → System → Exit kiosk*, Chromium closes and a sentinel file
is created (`data/.exit-kiosk`); the kiosk script sees it on its next loop
iteration and does **not** relaunch Chromium automatically — you land on the
bare desktop. No `sudo` needed, since nothing system-wide is touched. Back
to kiosk mode: run the script again, or reboot the Pi.

### Legal & support

At the bottom of the settings sidebar sit a privacy notice and a disclaimer
(each opens as its own window), plus a small donation link. All three are
plain text or a plain link — no connection to any service, no tracking.

---

## On the Raspberry Pi

Step by step: **[docs/raspberry-pi.md](docs/raspberry-pi.md)** *(German)* —
Node, the service, kiosk autostart, microphone, dimming the screen at night.
The finished files live in [`deploy/`](deploy/).

Short version: `npm install && npm run build`, then everything runs as
**one** process (`npm start`) on port 4000 — frontend and API together.

> Don't copy `node_modules` from your computer to the Pi: the binaries it
> contains are built for x86. Install fresh on the Pi instead.

## Next steps

Home Assistant state now runs over a WebSocket instead of polling
(`services/homeAssistantSocket.ts`) — one persistent connection instead of a
REST request per tile/sensor on every client poll; REST remains the
fallback while the connection isn't up yet. Tested live against a real HA
instance.

A movable crop frame per photo in the slideshow picker, and a Ken Burns
effect with nine alternating pan directions instead of one fixed zoom-in,
are done too (see *Photos for the slideshow*).

Open:

- Public-transport departures and commute time to work.
- A wake word instead of a button press (e.g. openWakeWord running locally
  on the Pi) — needs a microphone on the Pi first, which isn't sorted out
  yet.
