# Mosart Graphics Control

## What is it?

Mosart Graphics Control is a web-based tool that allows producers to manually trigger overlay graphics (story straps) during a live show. It reads the graphics from the Mosart rundown and presents them in a simple interface where you can take graphics in and out with a single click or keyboard shortcut.

The tool connects to Mosart's REST API and works alongside the existing automation. It does not replace any existing graphics workflow — it gives producers an additional way to fire straps when needed.

## How to access it

Open a browser (Chrome recommended) and go to the URL of the machine it is installed on, e.g.:

**http://your-server-hostname:3000/**

This is typically only accessible from within your network.

**Important:** This tool has direct control over on-air graphics. Access to this tool should be treated professionally and responsibly.

## How to use it

### Connecting

1. Open the URL in Chrome
2. You'll see a list of Mosart servers. Each server has a status indicator dot on the left:
   - **Green dot** — the server is reachable and responding
   - **Red dot** — the server cannot be reached (hover over it to see the error)
   - **Pulsing grey dot** — still testing the connection
3. Select the server for your control room
4. A warning will appear reminding you that this is a live broadcast environment — click **Connect**

### Switching to backup

If the director switches Mosart to the backup server, you must manually switch too:

1. Click the disconnect button at the top of the screen
2. Confirm the disconnect
3. Select the backup server from the list

This does not happen automatically.

### Using the graphics list

Once connected, you'll see all overlay graphics from the current rundown, grouped by story. The page number and story slug are shown as headers.

- The list follows the rundown order
- Graphics are colour-coded by their out behaviour (timed, story end, background end, manual)
- The current on-air story is highlighted
- **On Viz Mosart 5.14 and later:** graphics that are currently on air show a red border. This updates automatically — no configuration is needed.

### Filtering the list

A filter bar sits below the top bar. Use it to narrow the list to specific types of graphic without affecting the rundown. Available filters:

- **Manual In / Auto In** — filter by whether the graphic fires manually or on a timecode
- **Background End / Story End / Non-Auto Out** — filter by out behaviour
- **Search box** — free-text filter on graphic slug

Filters are additive within the type buttons. Click **Clear** to reset. The filter only affects the view — all graphics are still available to fire.

### Personal collection

Click the collection icon (split-panel button) in the top bar to open a side panel alongside the main list. You can drag graphics from the main list into your collection, or use the ⊕ button on each graphic.

- Your collection is saved in the browser — it persists across sessions on the same machine
- Press **Tab** to switch keyboard focus between the main list and the collection panel
- All keyboard shortcuts (arrows, Take In/Out) work in the collection panel when it has focus

### Taking graphics in and out

Each graphic has two buttons:

- **IN** — takes the graphic on air
- **OUT** — takes the graphic off air

You can also use keyboard shortcuts (see below).

### Keyboard shortcuts

| Key | Action |
|---|---|
| Up / Down | Navigate through the graphics list |
| Right arrow | Take IN the selected graphic |
| Left arrow | Take OUT the selected graphic |
| Esc | Take ALL graphics out |
| PgDn | Continue (advance through continue points) |
| Space | Jump to the current on-air story |
| Home | Jump to first graphic |
| End | Jump to last graphic |
| Ctrl + D | Toggle dark/light mode |

### Settings

Click the gear icon (top right when connected) to toggle display options:

- **Dark/Light mode** — toggles the UI colour scheme
- **Show Handler** — shows which graphics engine handles each graphic (DSK, WALL, etc.)
- **Show Continue Points** — shows how many continue points a graphic has
- **Show Continue Button** — adds a CONT button on graphics with continue points
- **Show On-Air Status** — enables or disables the red border on on-air graphics (Mosart 5.14+ only). Turning this off stops the app from polling the on-air endpoint. On by default.

All settings are saved per-user in the browser.

## Admin page

Click the **padlock icon** on the connect screen to access the Admin page. The default password is **1234**.

The Admin page has four tabs:

| Tab | What you can configure |
|---|---|
| **General** | TV station name (shown on the connect screen), poll intervals, inactivity timeout |
| **Servers** | Mosart server connections |
| **Handlers** | Which graphics handlers are shown, and their badge colours |
| **Security** | Application port, admin password |

All settings are shared — changes made on one machine are immediately visible to all other users.

## Where is it installed?

The application runs as a Windows Service on the designated server machine.

| | |
|---|---|
| **Port** | 3000 (configurable via Admin → Security) |
| **Install path** | `C:\Program Files\Mosart Graphics Control\` |
| **Windows Service name** | Mosart Graphics Control |
| **Settings file** | `C:\Program Files\Mosart Graphics Control\settings.json` |
| **Servers file** | `C:\Program Files\Mosart Graphics Control\servers.json` |

## Configuration files

### settings.json

Located in the root of the install folder. Contains all shared settings:

```json
{
  "stationName": "Your Station",
  "handlerConfig": [...],
  "pollConfig": { "timelineMs": 500, "graphicsMs": 1500 },
  "inactivityMinutes": 15,
  "adminPassword": "your-password"
}
```

This file is written automatically by the Admin page. You can also edit it directly in a text editor if needed (e.g. to reset a lost admin password — set `adminPassword` back to `"1234"`).

### servers.json

Contains the Mosart server connection list. Also written by the Admin page. Each server entry needs:

- **name** — display name shown in the UI
- **host** — hostname of the Mosart server
- **port** — REST API port (55167)
- **apiKey** — API key configured in Mosart's `RemoteDispatcherServiceConfig.xml`
- **id** — unique number

## Managing the Windows Service

The service can be managed from Windows Services:

1. Press `Win + R`, type `services.msc`, press Enter
2. Find **"Mosart Graphics Control"** in the list
3. Right-click to Start, Stop, or Restart

The service starts automatically when the server boots up and will restart itself if it crashes.

## Troubleshooting

**The page won't load at all**
Check that the Windows Service is running on the server. Also check that the port (default 3000) is open in Windows Firewall.

**The page loads but stays on "connecting..."**
The tool can't reach the Mosart server. Check that:
- The correct Mosart server is selected
- The Mosart server is running and reachable from the app server
- Port 55167 is open on the Mosart server
- The API key in `servers.json` matches the one in Mosart's `RemoteDispatcherServiceConfig.xml`

**Graphics are showing but not updating**
Try refreshing the browser. If the tab was in the background for a long time, Chrome may have throttled it — bringing it back to the foreground should trigger an immediate refresh.

**A graphic won't fire**
Check whether the director has switched to the backup Mosart server. If so, you need to disconnect and reconnect to the backup server manually.

**Error banner appears and disappears**
Temporary errors (e.g. a single failed API call) show a red banner that auto-dismisses after 5 seconds. If the error persists, check the Mosart server connection.

**Can't log in to Admin**
The default password is `1234`. If the password has been changed and is lost, edit `settings.json` on the server and set `adminPassword` back to `"1234"`.

## Technical details

- Built with React + Vite, served by a Node.js production server
- Communicates with Mosart via the REST API on port 55167 (Viz Mosart 5.13+)
- On Viz Mosart 5.14+, on-air status is fetched from a dedicated endpoint and shown as a red border on the graphic
- Poll intervals are configurable (default: timeline every 500ms, graphics every 1500ms)
- All API calls are proxied through the Node.js server to avoid CORS issues
- The proxy only allows connections to hostnames listed in `servers.json`
- Settings are stored centrally in `settings.json` — shared across all browsers

## Development and source code

For development instructions, see `GETTING-STARTED.md` included in the source code.
