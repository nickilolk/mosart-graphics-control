import { useState, useEffect, useCallback, useRef } from 'react';
import { darkTheme, lightTheme } from './styles/theme.js';
import ConnectPage from './components/ConnectPage.jsx';
import ControlPage from './components/ControlPage.jsx';
import AdminPage from './components/AdminPage.jsx';

const DEFAULT_SETTINGS = {
  stationName: '',
  handlerConfig: [],
  pollConfig: { timelineMs: 500, graphicsMs: 1500 },
  inactivityMinutes: 15,
  adminPassword: '1234',
};

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [connectedServer, setConnectedServer] = useState(null);
  const [currentPage, setCurrentPage] = useState('connect'); // 'connect' | 'control' | 'admin'

  // Servers — loaded from /api/servers (centrally stored in servers.json)
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [serversError, setServersError] = useState(null);

  // Shared settings — loaded from /api/settings (centrally stored in settings.json)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Personal display preferences — per-browser only
  const [showHandler, setShowHandler] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mosart-show-handler') ?? 'true'); } catch { return true; }
  });
  const [showContinuePoints, setShowContinuePoints] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mosart-show-continuepoints') ?? 'false'); } catch { return false; }
  });
  const [showThumbnails, setShowThumbnails] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mosart-show-thumbnails') ?? 'true'); } catch { return true; }
  });
  const [showContinueButton, setShowContinueButton] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mosart-show-continuebutton') ?? 'false'); } catch { return false; }
  });

  // Password gate state
  const [adminPasswordPrompt, setAdminPasswordPrompt] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState(false);

  // Load shared settings from server
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { setSettings({ ...DEFAULT_SETTINGS, ...data }); setSettingsLoading(false); })
      .catch(() => setSettingsLoading(false));
  }, []);

  // Load servers from server
  useEffect(() => {
    fetch('/api/servers')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setServers(Array.isArray(data) ? data : []); setServersLoading(false); })
      .catch(err => { setServersError(err.message); setServersLoading(false); });
  }, []);

  // Save a patch of settings to the server and update local state
  const saveSettings = useCallback(async (patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, []);

  // Save servers to server
  const saveServers = useCallback(async (newServers) => {
    setServers(newServers);
    try {
      await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServers),
      });
    } catch (err) {
      console.error('Failed to save servers:', err);
    }
  }, []);

  const openAdmin = useCallback(() => {
    setAdminPasswordPrompt(true);
    setAdminPasswordError(false);
  }, []);

  const submitAdminPassword = useCallback((pw) => {
    if (pw === settings.adminPassword) {
      setAdminPasswordPrompt(false);
      setAdminPasswordError(false);
      setCurrentPage('admin');
    } else {
      setAdminPasswordError(true);
    }
  }, [settings.adminPassword]);

  const cancelAdminPassword = useCallback(() => {
    setAdminPasswordPrompt(false);
    setAdminPasswordError(false);
  }, []);

  const toggleDarkMode = useCallback(() => setDarkMode(d => !d), []);
  const toggleShowHandler = useCallback(() => {
    setShowHandler(v => { const next = !v; try { localStorage.setItem('mosart-show-handler', JSON.stringify(next)); } catch {} return next; });
  }, []);
  const toggleShowContinuePoints = useCallback(() => {
    setShowContinuePoints(v => { const next = !v; try { localStorage.setItem('mosart-show-continuepoints', JSON.stringify(next)); } catch {} return next; });
  }, []);
  const toggleShowThumbnails = useCallback(() => {
    setShowThumbnails(v => { const next = !v; try { localStorage.setItem('mosart-show-thumbnails', JSON.stringify(next)); } catch {} return next; });
  }, []);
  const toggleShowContinueButton = useCallback(() => {
    setShowContinueButton(v => { const next = !v; try { localStorage.setItem('mosart-show-continuebutton', JSON.stringify(next)); } catch {} return next; });
  }, []);

  const vars = darkMode ? darkTheme : lightTheme;

  return (
    <div style={{
      ...Object.fromEntries(Object.entries(vars)),
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: "Arial, Helvetica, sans-serif",
      minHeight: '100vh',
    }}>
      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${vars['--border']}; border-radius: 2px; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {currentPage === 'connect' && !connectedServer && (
        <ConnectPage
          servers={servers}
          serversLoading={serversLoading || settingsLoading}
          serversError={serversError}
          onConnect={(server) => { setConnectedServer(server); setCurrentPage('control'); }}
          onAdmin={openAdmin}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          stationName={settings.stationName}
        />
      )}

      {currentPage === 'control' && connectedServer && (
        <ControlPage
          server={connectedServer}
          onDisconnect={() => { setConnectedServer(null); setCurrentPage('connect'); }}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          showHandler={showHandler}
          onToggleShowHandler={toggleShowHandler}
          showContinuePoints={showContinuePoints}
          onToggleShowContinuePoints={toggleShowContinuePoints}
          showThumbnails={showThumbnails}
          onToggleShowThumbnails={toggleShowThumbnails}
          showContinueButton={showContinueButton}
          onToggleShowContinueButton={toggleShowContinueButton}
          handlerConfig={settings.handlerConfig}
          pollConfig={settings.pollConfig}
          inactivityMinutes={settings.inactivityMinutes}
        />
      )}

      {currentPage === 'admin' && (
        <AdminPage
          servers={servers}
          onSave={saveServers}
          handlerConfig={settings.handlerConfig}
          onSaveHandlerConfig={(config) => saveSettings({ handlerConfig: config })}
          onChangePassword={(newPw) => saveSettings({ adminPassword: newPw })}
          stationName={settings.stationName}
          onSaveStationName={(name) => saveSettings({ stationName: name })}
          pollConfig={settings.pollConfig}
          onSavePollConfig={(config) => saveSettings({ pollConfig: config })}
          inactivityMinutes={settings.inactivityMinutes}
          onSaveInactivityMinutes={(minutes) => saveSettings({ inactivityMinutes: minutes })}
          onBack={() => setCurrentPage('connect')}
        />
      )}

      {/* Password gate modal */}
      {adminPasswordPrompt && (
        <AdminPasswordGate
          error={adminPasswordError}
          onSubmit={submitAdminPassword}
          onCancel={cancelAdminPassword}
        />
      )}
    </div>
  );
}

function AdminPasswordGate({ error, onSubmit, onCancel }) {
  const [pw, setPw] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(pw);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onCancel}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, width: 300 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, textAlign: 'center' }}>
          Admin Access
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Password"
            style={{
              width: '100%', padding: '8px 10px', border: `1px solid ${error ? '#e53935' : 'var(--border)'}`,
              borderRadius: 4, background: 'var(--surface)', color: 'var(--text-primary)',
              fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {error && (
            <div style={{ fontSize: 10, color: '#e53935', textAlign: 'center' }}>Incorrect password</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button type="button" onClick={onCancel}
              style={{ padding: '7px 20px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit"
              style={{ padding: '7px 20px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>
              Enter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
