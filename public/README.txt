============================================================
  MOSART GRAPHICS CONTROL — Deployment Guide
============================================================

This is a web-based control panel for Viz Mosart overlay
graphics. Once deployed, you open it in a browser and use
it to take graphics in and out during a live show.


NOTE: On Viz Mosart 5.14 and later, the app shows a red
border on any graphic that is currently on air. This works
automatically. On 5.13, everything else works the same.


------------------------------------------------------------
  WHAT YOU NEED
------------------------------------------------------------

1. A Windows machine that can reach your Mosart server(s)
   on the network. The Pilot Edge server is a good choice.

2. Node.js installed on that machine.
   Download from: https://nodejs.org
   Pick the LTS (Long Term Support) version.
   Install with default settings — just click Next.

   To verify it's installed, open PowerShell and type:
     node --version
   You should see something like v20.x.x or v22.x.x.


------------------------------------------------------------
  QUICK START (just run it)
------------------------------------------------------------

1. Copy these files to the server, for example to:
     C:\Program Files\Mosart Graphics Control\

   You need:
     server.js
     package.json
     install-service.js
     settings.json
     dist\   (the entire folder)

2. Open PowerShell, go to the folder:
     cd "C:\Program Files\Mosart Graphics Control"

3. Start it:
     node server.js

4. Open a browser and go to:
     http://localhost:3000

   From another machine on the network, use the server's
   hostname or IP instead of localhost, e.g.:
     http://pilot-edge-server:3000

5. To stop it, press Ctrl+C in the PowerShell window.


------------------------------------------------------------
  CONFIGURING THE APP
------------------------------------------------------------

All configuration is done through the Admin page inside
the app — no need to edit files manually.

1. Open the app in a browser
2. Click the padlock icon (bottom right of the connect screen)
3. Enter the admin password (default: 1234)
4. Configure as needed:

   GENERAL TAB
   - TV Station Name: shown on the connect screen
   - Poll Intervals: how often the app polls Mosart
   - Inactivity Timeout: auto-disconnect after idle time

   SERVERS TAB
   - Add/edit/remove Mosart server connections
   - Each server needs: name, host, port (55167), API key

   HANDLERS TAB
   - Filter which graphics handlers are shown
   - Assign colours to each handler

   SECURITY TAB
   - Change the application port (requires restart)
   - Change the admin password

Settings are saved to settings.json in the application
folder. Server connections are saved to dist\servers.json.
Both files are written automatically when you save in the
Admin page.

NOTE: If you need to configure servers before the app is
running (e.g. on first install), you can edit
dist\servers.json directly in a text editor. Example:

  [
    {
      "name": "CR1 Mosart Main",
      "host": "CR1-MOS-M",
      "port": 55167,
      "apiKey": "your-api-key",
      "id": 1
    }
  ]

Each server needs:
  - name:    Display name shown in the UI
  - host:    Hostname or IP of the Mosart server
  - port:    REST API port (default 55167)
  - apiKey:  API key from RemoteDispatcherServiceConfig.xml
  - id:      Unique number for each server


------------------------------------------------------------
  RUN AS A WINDOWS SERVICE (starts automatically)
------------------------------------------------------------

If you want it to start automatically when the server
boots up (and restart if it crashes), you can install it
as a Windows Service.

1. First, install the "node-windows" tool (one-time only).
   Open PowerShell and run:
     npm install -g node-windows

2. Open PowerShell AS ADMINISTRATOR:
   - Click Start
   - Type "PowerShell"
   - Right-click "Windows PowerShell"
   - Click "Run as administrator"

3. Go to the folder and install the service:
     cd "C:\Program Files\Mosart Graphics Control"
     node install-service.js

   You should see:
     Service installed. Starting...
     Service started.

4. That's it! The app is now running in the background.
   It will start automatically whenever the server restarts.

   You can manage it like any other Windows Service:
   - Press Win+R, type services.msc, press Enter
   - Find "Mosart Graphics Control" in the list
   - Right-click to Stop, Start, or change Startup Type


TO REMOVE THE SERVICE:

   Open PowerShell as Administrator and run:
     cd "C:\Program Files\Mosart Graphics Control"
     node install-service.js remove


------------------------------------------------------------
  CHANGING THE PORT
------------------------------------------------------------

The easiest way is via the Admin page (Security tab) —
the server will restart automatically and redirect your
browser to the new port.

Alternatively, you can set it manually:

Option A — one-time (when running manually):
  Open PowerShell and run:
    $env:PORT=8080; node server.js

Option B — permanently (for the Windows Service):
  Open install-service.js in a text editor (e.g. Notepad).
  Find this line:
    env: [{ name: 'PORT', value: '3000' }],
  Change 3000 to whatever port you want.
  Then re-install the service (see steps above).


------------------------------------------------------------
  UPDATING TO A NEW VERSION
------------------------------------------------------------

1. On your development machine, build the new version:
     npm run build

2. Copy the updated files to the server:
     server.js         (replace)
     dist\             (replace the entire folder)
     settings.json     (keep your existing file — do NOT
                        overwrite it, it contains your
                        configured settings)

   If settings.json doesn't exist yet on the server,
   copy it from the development machine.

3. If running manually: stop (Ctrl+C) and start again.
   If running as a service: restart it from services.msc
   (right-click > Restart).

   You do NOT need to re-install the service — just
   restart it so it picks up the new files.


------------------------------------------------------------
  TROUBLESHOOTING
------------------------------------------------------------

"node" is not recognized...
  Node.js isn't installed, or PowerShell can't find it.
  Install Node.js and restart PowerShell.

The page loads but says "connecting..."
  The browser can reach this server, but this server
  can't reach your Mosart server. Open the Admin page
  (padlock icon, default password: 1234) and check the
  Servers tab — verify the hostname, port, and API key.

Server shows a red dot on the connect page
  The app tests each server connection on page load.
  A red dot means it couldn't reach that Mosart server.
  Hover over the server to see the error message.

Can't log in to Admin
  The default password is 1234. If the password has been
  changed and is lost, open settings.json in a text editor
  and set "adminPassword" back to "1234".

Port 3000 is already in use
  Something else is using that port. Either stop the
  other application, or change the port via the Admin
  page (Security tab) or by editing install-service.js.

Can't access from other machines on the network
  Make sure port 3000 (or your chosen port) is open in
  Windows Firewall on the machine running the app.


============================================================
