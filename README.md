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
| **Security** | Application port, admin password |

Settings are stored in `settings.json` (in the project root). Server connections are stored in `public/servers.json` (dev) or `dist/servers.json` (production). Both files are read and written by the server — you don't need to edit them manually.

> `settings.json` is excluded from the repo (it contains your admin password and site-specific config). A clean template is provided as `settings.example.json` — the app will use built-in defaults if `settings.json` doesn't exist yet.

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
| Ctrl+D | Toggle dark/light mode |

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
public/
└── servers.json               # Mosart server connections
```

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
