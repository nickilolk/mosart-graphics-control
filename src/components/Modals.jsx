import { XIcon } from './Icons.jsx';

export function ShortcutsModal({ onClose }) {
  const shortcuts = [
    { keys: '↑ / ↓', action: 'Navigate graphics list' },
    { keys: '→', action: 'Take IN selected graphic' },
    { keys: '←', action: 'Take OUT selected graphic' },
    { keys: 'Esc', action: 'Take ALL out' },
    { keys: 'PgDn', action: 'Continue graphic' },
    { keys: 'Space', action: 'Cue to on-air story' },
    { keys: 'Ctrl + D', action: 'Toggle dark/light mode' },
    { keys: 'Home', action: 'Jump to first graphic' },
    { keys: 'End', action: 'Jump to last graphic' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, width: 320 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Keyboard Shortcuts</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><XIcon /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shortcuts.map((s) => (
            <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--surface)', padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit' }}>{s.keys}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DisconnectModal({ serverName, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onCancel}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, width: 300, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Disconnect from {serverName}?</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
          You'll be returned to the server selection screen.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '7px 20px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '7px 20px', borderRadius: 5, border: 'none', background: '#e53935', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>Disconnect</button>
        </div>
      </div>
    </div>
  );
}

export function ConnectWarningModal({ serverName, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onCancel}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, width: 340, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#ff9800', marginBottom: 12 }}>Warning</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>
          You are connecting to a <strong>live broadcast environment</strong>.<br /><br />
          Abuse of this tool can have serious consequences.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '7px 20px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '7px 20px', borderRadius: 5, border: 'none', background: '#ff9800', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>Connect</button>
        </div>
      </div>
    </div>
  );
}
