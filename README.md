# Viz Mosart Graphics Control

A web-based overlay graphics control panel for Viz Mosart 5.13+.

## Requirements

- **Node.js** 18+ (check with `node --version`)
- **Viz Mosart** 5.13+ with Remote Control Service running
- API key configured in `RemoteDispatcherServiceConfig.xml`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
```

The app opens at `http://localhost:3000`. Configure servers and settings via the Admin page (padlock icon, default password: `1234`).

## Configuration

All configuration is done through the **Admin page** in the browser. Click the padlock icon on the connect screen and enter the admin password (default: `1234`).

### Admin tabs

| Tab | What you can configure |
|---|---|
| **General** | TV station name, poll intervals, inactivity timeout |
| **Servers** | Mosart server connections (name, host, port, API key) |
| **Handlers** | Which graphics handlers to show and their badge colours |
| **Direct Takes** | Direct take buttons shown in the control view (recall number, name, optional shortcut) |
| **Security** | Application port, admin password |

Settings are stored in `settings.json` (in the project root). Server connections are stored in `servers.json` (in the project root), read and written by the server — you don't need to edit them manually.

> `settings.json` and `servers.json` are excluded from the repo (they contain your admin password, API keys, and site-specific config). Clean templates are provided as `settings.example.json` and `servers.example.json` — the app will use built-in defaults if `settings.json` doesn't exist yet.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| ↑ / ↓ | Navigate graphics list |
| → | Take IN selected graphic |
| ← | Take OUT selected graphic |
| Esc | Take ALL out |
| PgDn | Continue (advance through continue points) |
| Space | Jump to current on-air story |
| Home | Jump to first graphic |
| End | Jump to last graphic |
| Tab | Switch focus between main list and collection panel |
| Ctrl+D | Toggle dark/light mode |
| Ctrl+F | Focus the search/filter bar (Escape to return) |
| *(custom)* | Trigger a configured direct take (assigned per take in Admin) |

## Project Structure

```
src/
├── App.jsx                    # Root component, theme, page routing
├── main.jsx                   # React entry point
├── services/
│   └── mosartApi.js           # REST API client (all HTTP calls)
├── hooks/
│   └── useMosartConnection.js # Polling, state management, actions
├── components/
│   ├── ConnectPage.jsx        # Server selection screen
│   ├── ControlPage.jsx        # Main control interface
│   ├── AdminPage.jsx          # Admin configuration UI
│   ├── GraphicBadge.jsx       # Individual graphic in the list
│   ├── Modals.jsx             # Shortcuts + disconnect dialogs
│   └── Icons.jsx              # SVG icon components
└── styles/
    └── theme.js               # Dark/light themes, out behavior config

server.js                      # Production server + API endpoints
settings.json                  # Shared settings (station name, handlers, etc.)
servers.json                   # Mosart server connections
servers.example.json           # Template for servers.json
```

## UI Features

### Filter bar

A filter bar sits below the top bar and lets you narrow the graphics list without changing the rundown. You can combine filters freely:

| Filter | What it shows |
|---|---|
| **Manual In** | Graphics that fire immediately (no timecode) |
| **Auto In** | Graphics that fire on a timecode |
| **Background End** | Graphics with BACKGROUNDEND out behaviour |
| **Story End** | Graphics with STORYEND out behaviour |
| **Non-Auto Out** | Graphics with MANUAL out behaviour |
| **Search** | Free-text filter on graphic slug |

Filters are OR-combined within the type buttons, and AND-combined with the text search. Click **Clear** to reset everything.

### Collection panel

Click the collection icon (split-panel icon in the top bar) to open a personal side panel alongside the main list. Drag any graphic from the main list into the panel, or use the ⊕ button on each graphic.

- Persisted per-user in browser localStorage
- Full keyboard navigation — press **Tab** to switch focus between the main list and the collection
- All arrow key / Take In / Take Out shortcuts work in the collection panel when it has focus

### Direct Takes deck

When direct takes are configured in Admin, a button deck appears docked at the bottom of the main panel. Buttons fill the available width per row — one button fills the full width, two share it equally, three share it in thirds. A fourth button starts a new row.

Each button can optionally have a keyboard shortcut assigned. Shortcuts are validated against the system shortcuts and against each other, so no two takes can share the same key. Configured shortcuts also appear in the keyboard shortcuts modal (keyboard icon in the top bar).

The deck can be hidden via **Show Direct Takes** in the settings dropdown.

### Settings

Click the gear icon (top right when connected) to access display toggles:

| Toggle | Default | What it controls |
|---|---|---|
| **Dark/Light mode** | Dark | UI colour scheme |
| **Show Handler** | Off | Shows which graphics engine handles each graphic |
| **Show Continue Points** | Off | Shows how many continue points a graphic has |
| **Show Continue Button** | Off | Adds a CONT button on graphics with continue points |
| **Show On-Air Status** | On | Enables red border on on-air graphics (requires Mosart 5.14+). Disable to stop polling the on-air endpoint. |
| **Show Direct Takes** | On | Shows or hides the direct takes deck at the bottom of the control view. Only appears if at least one direct take is configured. |

All toggles are persisted per-user in browser localStorage.

## Mosart API Endpoints Used

All via Mosart Remote Control Service (port 55167):

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/timeline` | Current/next story (polled every 500ms by default) |
| `GET /api/v1/rundown` | Story names and ordering (polled every 1500ms by default) |
| `GET /api/v1/assets/graphics` | All overlay graphics (polled every 1500ms by default) |
| `GET /api/v1/assets/graphics?onair=true` | On-air graphics — used for red border indicator (5.14+ only) |
| `POST /api/v1/assets/graphics/{id}/take` | Trigger a graphic |
| `POST /api/v1/assets/graphics/{id}/take-out` | Take out a graphic |

## Building for Production

```bash
npm run build
```

Output goes to `dist/`. See `public/README.txt` for full deployment instructions.
