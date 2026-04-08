# Getting Started with Mosart Graphics Control

This guide assumes you have never used VS Code or any coding tools before. Follow each step in order.

---

## Step 1: Install Node.js

Node.js is the engine that runs the app. You only need to install it once.

1. Go to **https://nodejs.org**
2. Click the big green **LTS** button to download
3. Run the installer — click **Next** through everything, keep all defaults
4. When it's done, restart your computer

**To verify it worked:**
- Press `Win + R`, type `powershell`, press Enter
- Type `node --version` and press Enter
- You should see something like `v22.x.x`

---

## Step 2: Install VS Code

VS Code is a free code editor from Microsoft. It's where you'll view and edit the project.

1. Go to **https://code.visualstudio.com**
2. Click the big blue **Download** button
3. Run the installer — keep all defaults, but tick the box that says **"Add to PATH"** if you see it
4. Open VS Code when it's done

---

## Step 3: Install Claude Code

Claude Code is an AI assistant that lives inside VS Code. It can help you understand, modify, and debug the project.

1. Open VS Code
2. Click the **Extensions** icon on the left sidebar (it looks like four small squares)
3. In the search box, type **Claude Code**
4. Find **"Claude Code"** by Anthropic and click **Install**
5. After installing, you'll see a Claude icon in the left sidebar — click it
6. Follow the sign-in prompts to connect your Anthropic account

You can now ask Claude questions about the code, ask it to make changes, or get help when something breaks. Just open the Claude panel and type your question.

---

## Step 4: Open the Project

1. Unzip the project folder you received to somewhere on your computer, for example: `C:\Projects\mosart-graphics-control`
2. In VS Code, go to **File > Open Folder...**
3. Navigate to the folder you unzipped and click **Select Folder**
4. You should see all the project files in the left sidebar

---

## Step 5: Install Dependencies

The project uses external libraries that need to be downloaded once.

1. In VS Code, open the terminal: go to **Terminal > New Terminal** (or press `` Ctrl + ` ``)
2. A terminal panel appears at the bottom of VS Code
3. Type this command and press Enter:

```
npm install
```

4. Wait for it to finish — it will download everything the project needs. This can take a minute or two. You'll see a lot of text scrolling by, that's normal.

---

## Step 6: Run the App (Development Mode)

This starts the app on your computer so you can use it and make changes.

1. In the terminal, type:

```
npm run dev
```

2. After a few seconds you'll see a message like:

```
Local: http://localhost:3000/
```

3. A browser tab should open automatically. If it doesn't, open Chrome and go to **http://localhost:3000**

4. You should see the Mosart Graphics Control connect page

**To stop the app:** Click in the terminal and press `Ctrl + C`

---

## Step 7: Configure the App

All configuration is done through the **Admin page** inside the app — no need to edit files manually.

1. On the connect screen, click the **padlock icon** (bottom right)
2. Enter the admin password — the default is **1234**
3. You'll see five tabs:

   - **General** — Set your TV station name, adjust poll intervals, set inactivity timeout
   - **Servers** — Add your Mosart server connections (hostname, port, API key)
   - **Handlers** — Configure which graphics handlers to show and their colours
   - **Direct Takes** — Configure direct take buttons shown at the bottom of the control view (recall number, name, optional keyboard shortcut)
   - **Security** — Change the application port or admin password

4. After making changes, click **Save** in each section
5. Click **Back** to return to the connect screen

Settings are saved to `settings.json` in the project folder. Server connections are saved to `servers.json` in the same folder. Both are picked up automatically — no restart needed.

---

## Step 8: Build for Production

When you're ready to deploy the app to a server, you need to build it.

1. Stop the dev server if it's running (`Ctrl + C` in the terminal)
2. Type:

```
npm run build
```

3. This creates a **dist/** folder containing the compiled app

4. To deploy, copy these files to the target machine:

```
server.js
package.json
install-service.js
settings.json
servers.json
dist/              (the entire folder)
```

5. On the target machine, open PowerShell, navigate to the folder, and run:

```
node server.js
```

The app will be available at **http://localhost:3000** (or the machine's hostname from other computers on the network).

See **dist/README.txt** for full deployment instructions, including how to install it as a Windows Service that starts automatically.

---

## Everyday Workflow

Once everything is set up, your daily workflow is simple:

| What you want to do | Command |
|---|---|
| Start the app for development | `npm run dev` |
| Stop the app | `Ctrl + C` in the terminal |
| Build for production | `npm run build` |
| Configure the app | Click the padlock icon in the browser |
| Ask Claude for help | Open the Claude panel in VS Code and type your question |

---

## What you'll see

Once connected to a Mosart server, the app shows all overlay graphics from the rundown. If the server is running Viz Mosart 5.14 or later, any graphic that is currently on air shows a red border — this updates automatically with no extra configuration.

On Mosart 5.13, everything works the same way except the red border is not available.

---

## Troubleshooting

**"node" is not recognized**
Node.js isn't installed properly. Go back to Step 1 and make sure to restart your computer after installing.

**"npm install" shows errors**
Make sure you're in the right folder. The terminal should show the project folder name (e.g. `mosart-graphics-control`). If not, go to **File > Open Folder** in VS Code and reopen the correct folder.

**The page loads but says "connecting..."**
The app can't reach the Mosart server. Open the Admin page (padlock icon) and check that the hostname, port, and API key in the Servers tab are correct, and that the machine running the app can reach the Mosart server on the network.

**The page doesn't load at all**
Make sure `npm run dev` is still running in the terminal. Look for error messages in red.

**I want to undo a change I made**
Ask Claude: "Can you undo the last change?" or press `Ctrl + Z` in the file you changed.
