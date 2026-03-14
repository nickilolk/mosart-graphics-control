import { useState, useEffect } from 'react';
import { ChevronRight, SunIcon, MoonIcon, AdminIcon } from './Icons.jsx';
import { FIXED_WIDTH } from '../styles/theme.js';
import { ConnectWarningModal } from './Modals.jsx';
import { createMosartApi } from '../services/mosartApi.js';

export default function ConnectPage({ servers, serversLoading, serversError, onConnect, onAdmin, darkMode, onToggleDarkMode, stationName }) {
  const [pendingServer, setPendingServer] = useState(null);
  // Map of server id → { status: 'testing'|'ok'|'fail', error?: string }
  const [connStatus, setConnStatus] = useState({});

  // Test all servers on load
  useEffect(() => {
    if (serversLoading || servers.length === 0) return;

    servers.forEach(s => {
      setConnStatus(prev => ({ ...prev, [s.id]: { status: 'testing' } }));

      const api = createMosartApi(s);
      api.getTimeline()
        .then(() => {
          setConnStatus(prev => ({ ...prev, [s.id]: { status: 'ok' } }));
        })
        .catch(err => {
          setConnStatus(prev => ({ ...prev, [s.id]: { status: 'fail', error: err.message } }));
        });
    });
  }, [servers, serversLoading]);

  return (
    <div style={{
      width: FIXED_WIDTH, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '20px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
          {stationName || 'Viz Mosart'}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: 0.5 }}>
          Graphics Control
        </h1>
        <div style={{ width: 40, height: 2, background: 'var(--accent)', margin: '12px auto 0' }} />
      </div>

      <div style={{ width: '100%', marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>
          Select Server
        </div>

        {serversLoading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            Loading servers...
          </div>
        )}

        {serversError && (
          <div style={{
            padding: '12px 14px', borderRadius: 6,
            background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.3)',
            fontSize: 11, color: '#e53935', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Could not load server list</div>
            <div>{serversError}</div>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)' }}>
              Edit <strong>servers.json</strong> in the application's public folder to configure servers.
            </div>
          </div>
        )}

        {!serversLoading && !serversError && servers.length === 0 && (
          <div style={{
            padding: '12px 14px', borderRadius: 6,
            background: 'var(--surface)', border: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            No servers configured. Edit <strong>servers.json</strong> in the application's public folder to add servers.
          </div>
        )}

        {!serversLoading && servers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {servers.map((s) => {
              const cs = connStatus[s.id];
              const isOk = cs?.status === 'ok';
              const isFail = cs?.status === 'fail';
              const isTesting = cs?.status === 'testing';

              const borderColor = isOk ? 'rgba(76,175,80,0.5)' : isFail ? 'rgba(229,57,53,0.3)' : 'var(--border)';
              const hoverBorder = isOk ? 'rgba(76,175,80,0.8)' : isFail ? 'rgba(229,57,53,0.5)' : 'var(--accent)';

              return (
                <button key={s.id} onClick={() => setPendingServer(s)}
                  title={isFail ? cs.error : isOk ? 'Connection OK' : isTesting ? 'Testing connection...' : ''}
                  style={{
                    width: '100%', padding: '12px 16px', border: `1px solid ${borderColor}`,
                    borderRadius: 6, background: isFail ? 'rgba(229,57,53,0.03)' : 'var(--surface)',
                    color: isFail ? 'var(--text-dim)' : 'var(--text-primary)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'inherit', fontSize: 12, transition: 'all 0.15s',
                    opacity: isFail ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.background = isFail ? 'rgba(229,57,53,0.06)' : 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.background = isFail ? 'rgba(229,57,53,0.03)' : 'var(--surface)'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: isOk ? '#4caf50' : isFail ? '#e53935' : 'var(--text-dim)',
                      boxShadow: isOk ? '0 0 6px rgba(76,175,80,0.5)' : 'none',
                      animation: isTesting ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                    </div>
                  </div>
                  <ChevronRight />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onToggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>
        <button onClick={onAdmin} title="Admin"
          style={{
            color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <AdminIcon />
        </button>
      </div>

      {pendingServer && (
        <ConnectWarningModal
          serverName={pendingServer.name}
          onConfirm={() => { setPendingServer(null); onConnect(pendingServer); }}
          onCancel={() => setPendingServer(null)}
        />
      )}
    </div>
  );
}
