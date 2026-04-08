import { useState, useEffect, useRef } from 'react';
import { FIXED_WIDTH, HANDLER_COLORS } from '../styles/theme.js';
import { BackIcon, PencilIcon, TrashIcon, PlusIcon } from './Icons.jsx';
import { createMosartApi, isVersionAtLeast } from '../services/mosartApi.js';

const emptyServer = { name: '', host: '', port: 55167, apiKey: '' };

export default function AdminPage({ servers, onSave, handlerConfig, onSaveHandlerConfig, directTakesConfig, onSaveDirectTakesConfig, onChangePassword, stationName, onSaveStationName, pollConfig, onSavePollConfig, inactivityMinutes, onSaveInactivityMinutes, onBack }) {
  const [tab, setTab] = useState('general'); // 'general' | 'servers' | 'handlers' | 'directtakes' | 'security'

  return (
    <div style={{
      width: FIXED_WIDTH, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', padding: '20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={onBack}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 4,
            height: 28, padding: '0 10px', cursor: 'pointer', color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'inherit',
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
          <BackIcon /> Back
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Admin
        </h2>
        <div style={{ width: 70 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'general', label: 'General' },
          { id: 'servers', label: 'Servers' },
          { id: 'handlers', label: 'Handlers' },
          { id: 'directtakes', label: 'Direct Takes' },
          { id: 'security', label: 'Security' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '7px 0', border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', color: tab === t.id ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: 11, fontWeight: tab === t.id ? 700 : 400, fontFamily: 'inherit',
              marginBottom: -1, textAlign: 'center',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'general' && (
        <GeneralTab stationName={stationName} onSaveStationName={onSaveStationName} pollConfig={pollConfig} onSavePollConfig={onSavePollConfig} inactivityMinutes={inactivityMinutes} onSaveInactivityMinutes={onSaveInactivityMinutes} />
      )}
      {tab === 'servers' && (
        <ServersTab servers={servers} onSave={onSave} />
      )}
      {tab === 'handlers' && (
        <HandlersTab handlerConfig={handlerConfig} onSave={onSaveHandlerConfig} />
      )}
      {tab === 'directtakes' && (
        <DirectTakesTab directTakesConfig={directTakesConfig} onSave={onSaveDirectTakesConfig} />
      )}
      {tab === 'security' && (
        <SecurityTab onChangePassword={onChangePassword} />
      )}
    </div>
  );
}

// ─── General Tab ────────────────────────────────────────────────────────────

function GeneralTab({ stationName, onSaveStationName, pollConfig, onSavePollConfig, inactivityMinutes, onSaveInactivityMinutes }) {
  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, display: 'block', letterSpacing: 0.5 };
  const sectionStyle = { paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <StationNameSection inputStyle={inputStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} stationName={stationName} onSave={onSaveStationName} />
      <PollIntervalsSection inputStyle={inputStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} pollConfig={pollConfig} onSave={onSavePollConfig} />
      <InactivitySection inputStyle={inputStyle} labelStyle={labelStyle} inactivityMinutes={inactivityMinutes} onSave={onSaveInactivityMinutes} />
    </div>
  );
}

function PollIntervalsSection({ inputStyle, labelStyle, sectionStyle, pollConfig, onSave }) {
  const [timelineMs, setTimelineMs] = useState(String(pollConfig?.timelineMs ?? 500));
  const [graphicsMs, setGraphicsMs] = useState(String(pollConfig?.graphicsMs ?? 1500));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savedTimerRef = useRef(null);

  const handleSave = () => {
    const tl = parseInt(timelineMs, 10);
    const gx = parseInt(graphicsMs, 10);
    if (!tl || tl < 100 || !gx || gx < 100) {
      setError('Both intervals must be at least 100 ms.');
      return;
    }
    setError('');
    onSave({ timelineMs: tl, graphicsMs: gx });
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
        Poll Intervals
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>
        How often the app polls the Mosart server. Lower values are more responsive but increase network load. Changes take effect immediately.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Timeline interval (ms) — default 500</label>
          <input type="number" min="100" value={timelineMs} onChange={e => setTimelineMs(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Graphics interval (ms) — default 1500</label>
          <input type="number" min="100" value={graphicsMs} onChange={e => setGraphicsMs(e.target.value)} style={inputStyle} />
        </div>
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 11, color: '#e53935' }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave}
          style={{ padding: '7px 16px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>
          Save
        </button>
        {saved && <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>✓ Saved</span>}
      </div>
    </div>
  );
}

function InactivitySection({ inputStyle, labelStyle, inactivityMinutes, onSave }) {
  const [value, setValue] = useState(String(inactivityMinutes ?? 15));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savedTimerRef = useRef(null);

  const handleSave = () => {
    const mins = parseInt(value, 10);
    if (isNaN(mins) || mins < 0) {
      setError('Enter a number of minutes (0 to disable).');
      return;
    }
    setError('');
    onSave(mins);
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
        Inactivity Timeout
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>
        Automatically disconnect after this many minutes of no keyboard or mouse activity. Set to 0 to disable.
      </div>
      <label style={labelStyle}>Timeout (minutes) — default 15</label>
      <input type="number" min="0" value={value} onChange={e => setValue(e.target.value)} style={inputStyle} />
      {error && <div style={{ marginTop: 8, fontSize: 11, color: '#e53935' }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave}
          style={{ padding: '7px 16px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>
          Save
        </button>
        {saved && <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>✓ Saved</span>}
      </div>
    </div>
  );
}

// ─── Servers Tab ────────────────────────────────────────────────────────────

function ServersTab({ servers, onSave }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyServer);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [testError, setTestError] = useState('');

  const startAdd = () => { setEditing('new'); setForm(emptyServer); setDeleteConfirm(null); resetTest(); };
  const startEdit = (s) => { setEditing(s.id); setForm({ name: s.name, host: s.host, port: s.port, apiKey: s.apiKey }); setDeleteConfirm(null); resetTest(); };
  const cancelEdit = () => { setEditing(null); setForm(emptyServer); resetTest(); };
  const resetTest = () => { setTestStatus(null); setTestError(''); };

  const saveEdit = async () => {
    const trimmed = { name: form.name.trim(), host: form.host.trim(), port: Number(form.port), apiKey: form.apiKey.trim() };
    if (!trimmed.name || !trimmed.host || !trimmed.port) return;
    // Warn if the target server is older than supported (v5.13)
    try {
      const api = createMosartApi(trimmed);
      const b = await api.getBuild().catch(() => null);
      if (b?.version && !isVersionAtLeast(b.version, '5.13.0')) {
        const proceed = window.confirm(`This app only supports Viz Mosart version 5.13+. The server you're trying to connect to, is version ${b.version}. Proceed anyway?`);
        if (!proceed) return;
      }
    } catch (err) {
      // Non-fatal — allow save even if build check fails
    }

    if (editing === 'new') {
      const maxId = servers.reduce((max, s) => Math.max(max, s.id), 0);
      onSave([...servers, { ...trimmed, id: maxId + 1 }]);
    } else {
      onSave(servers.map(s => s.id === editing ? { ...s, ...trimmed } : s));
    }
    setEditing(null); setForm(emptyServer); resetTest();
  };

  const testConnection = async () => {
    const trimmed = { host: form.host.trim(), port: Number(form.port), apiKey: form.apiKey.trim() };
    if (!trimmed.host || !trimmed.port) return;
    setTestStatus('testing'); setTestError('');
    try {
      const api = createMosartApi(trimmed);
      // Prefer build check so we can warn about unsupported versions
      const b = await api.getBuild().catch(() => null);
      if (b?.version && !isVersionAtLeast(b.version, '5.13.0')) {
        setTestStatus('warn');
        setTestError(`This app only supports Viz Mosart version 5.13+. The server you're trying to connect to, is version ${b.version}`);
        return;
      }
      await api.getTimeline();
      setTestStatus('ok');
    } catch (err) {
      setTestStatus('fail'); setTestError(err.message);
    }
  };

  const confirmDelete = (id) => { onSave(servers.filter(s => s.id !== id)); setDeleteConfirm(null); };
  const updateField = (field, value) => { setForm(prev => ({ ...prev, [field]: value })); if (testStatus) resetTest(); };

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, display: 'block', letterSpacing: 0.5 };

  function renderForm() {
    const canTest = form.host.trim() && form.port;
    const canSave = form.name.trim() && form.host.trim() && form.port;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: editing !== 'new' ? 10 : 0 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Studio A" />
        </div>
        <div>
          <label style={labelStyle}>Host</label>
          <input style={inputStyle} value={form.host} onChange={e => updateField('host', e.target.value)} placeholder="e.g. studio-a-mosart.local" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Port</label>
            <input style={inputStyle} type="number" value={form.port} onChange={e => updateField('port', e.target.value)} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>API Key</label>
            <input style={inputStyle} type="password" value={form.apiKey} onChange={e => updateField('apiKey', e.target.value)} placeholder="See RemoteDispatcherServiceConfig.xml" />
          </div>
        </div>
        {testStatus === 'ok' && (
          <div style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', fontSize: 10, color: '#4caf50' }}>
            Connection successful
          </div>
        )}
        {testStatus === 'warn' && (
          <div style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.18)', fontSize: 10, color: '#ff9800' }}>
            Warning: {testError}
          </div>
        )}
        {testStatus === 'fail' && (
          <div style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', fontSize: 10, color: '#e53935' }}>
            Connection failed{testError ? `: ${testError}` : ''}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button onClick={testConnection} disabled={!canTest || testStatus === 'testing'}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 14px', cursor: (!canTest || testStatus === 'testing') ? 'default' : 'pointer', color: 'var(--text-secondary)', fontSize: 10, fontFamily: 'inherit', opacity: (!canTest || testStatus === 'testing') ? 0.4 : 1 }}>
            {testStatus === 'testing' ? 'Testing...' : 'Test'}
          </button>
          <button onClick={cancelEdit}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 10, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={saveEdit} disabled={!canSave}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: !canSave ? 'default' : 'pointer', color: '#fff', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', opacity: !canSave ? 0.4 : 1 }}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      {servers.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
          No servers configured. Add one below.
        </div>
      )}
      {servers.map(s => (
        <div key={s.id}>
          <div style={{
            padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 6,
            background: editing === s.id ? 'var(--surface-hover)' : 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{s.host}:{s.port}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => startEdit(s)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PencilIcon />
              </button>
              <button onClick={() => setDeleteConfirm(s.id)}
                style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', color: '#e53935', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrashIcon />
              </button>
            </div>
          </div>
          {deleteConfirm === s.id && (
            <div style={{ margin: '4px 0', padding: '10px 14px', border: '1px solid rgba(229,57,53,0.3)', borderRadius: 6, background: 'rgba(229,57,53,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#e53935' }}>Delete "{s.name}"?</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setDeleteConfirm(null)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 10, fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={() => confirmDelete(s.id)}
                  style={{ background: '#e53935', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 600, fontFamily: 'inherit' }}>
                  Delete
                </button>
              </div>
            </div>
          )}
          {editing === s.id && renderForm()}
        </div>
      ))}
      {editing === 'new' && (
        <div style={{ border: '1px solid var(--accent)', borderRadius: 6, background: 'var(--surface)', padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>New Server</div>
          {renderForm()}
        </div>
      )}
      {editing === null && (
        <button onClick={startAdd}
          style={{ marginTop: 8, width: '100%', padding: '10px', border: '1px dashed var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
          <PlusIcon /> Add Server
        </button>
      )}
    </div>
  );
}

// ─── Handlers Tab ────────────────────────────────────────────────────────────

function nextHandlerName(lastName) {
  const match = lastName?.match(/^(.*?)(\d+)$/);
  if (match) return match[1] + (parseInt(match[2], 10) + 1);
  return '';
}

function HandlersTab({ handlerConfig, onSave }) {
  const MAX_HANDLERS = 64;
  const [focusIndex, setFocusIndex] = useState(-1);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(null);

  const save = (config) => {
    onSave(config);
    setSavedFlash(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1500);
  };

  const updateHandler = (index, field, value) => {
    save(handlerConfig.map((h, i) => i === index ? { ...h, [field]: value } : h));
  };

  const addHandler = () => {
    if (handlerConfig.length >= MAX_HANDLERS) return;
    const last = handlerConfig[handlerConfig.length - 1];
    const name = nextHandlerName(last?.name);
    const color = last?.color ?? HANDLER_COLORS[0].color;
    const newIndex = handlerConfig.length;
    save([...handlerConfig, { name, color }]);
    setFocusIndex(newIndex);
    setTimeout(() => setFocusIndex(-1), 100);
  };

  const removeHandler = (index) => {
    save(handlerConfig.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, flex: 1 }}>
          Configure which graphic handlers are shown in the control view. If no handlers are configured, all graphics are shown.
          Each handler can be assigned one of three badge colors.
        </div>
        <span style={{
          fontSize: 10, color: '#4caf50', marginLeft: 12, flexShrink: 0,
          opacity: savedFlash ? 1 : 0, transition: 'opacity 0.4s',
        }}>
          ✓ Saved
        </span>
      </div>

      {handlerConfig.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 6 }}>
          No handlers configured — all graphics will be shown.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {handlerConfig.map((handler, index) => (
          <HandlerRow
            key={index}
            handler={handler}
            focusOnMount={index === focusIndex}
            onChangeName={v => updateHandler(index, 'name', v)}
            onChangeColor={v => updateHandler(index, 'color', v)}
            onRemove={() => removeHandler(index)}
          />
        ))}
      </div>

      {handlerConfig.length < MAX_HANDLERS && (
        <button onClick={addHandler}
          style={{ marginTop: 4, width: '100%', padding: '10px', border: '1px dashed var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
          <PlusIcon /> Add Handler {handlerConfig.length > 0 ? `(${handlerConfig.length}/${MAX_HANDLERS})` : ''}
        </button>
      )}
    </div>
  );
}

function HandlerRow({ handler, onChangeName, onChangeColor, onRemove, focusOnMount }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (focusOnMount && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
      {/* Color swatches */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {HANDLER_COLORS.map(c => (
          <button key={c.id} onClick={() => onChangeColor(c.color)} title={c.label}
            style={{
              width: 20, height: 20, borderRadius: 4, background: c.color, border: handler.color === c.color ? '2px solid var(--text-primary)' : '2px solid transparent',
              cursor: 'pointer', padding: 0, flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Name input */}
      <input
        ref={inputRef}
        value={handler.name}
        onChange={e => onChangeName(e.target.value)}
        placeholder="Handler name, e.g. DSK"
        style={{
          flex: 1, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 4,
          background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
          outline: 'none',
        }}
      />

      {/* Remove */}
      <button onClick={onRemove}
        style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', borderRadius: 4, width: 26, height: 26, cursor: 'pointer', color: '#e53935', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <TrashIcon />
      </button>
    </div>
  );
}

// ─── Security Tab ────────────────────────────────────────────────────────────

function SecurityTab({ onChangePassword }) {
  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, display: 'block', letterSpacing: 0.5 };
  const sectionStyle = { paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PortSection inputStyle={inputStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} />
      <PasswordSection inputStyle={inputStyle} labelStyle={labelStyle} onChangePassword={onChangePassword} />
    </div>
  );
}

function StationNameSection({ inputStyle, labelStyle, sectionStyle, stationName, onSave }) {
  const [value, setValue] = useState(stationName ?? '');
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef(null);

  const handleSave = () => {
    onSave(value.trim());
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
        TV Station Name
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>
        Shown on the connect screen above "Graphics Control". Leave empty to use the default "VIZ MOSART".
      </div>
      <label style={labelStyle}>Station Name</label>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="VIZ MOSART"
        maxLength={100}
        style={inputStyle}
      />
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave}
          style={{
            padding: '7px 16px', borderRadius: 5, border: 'none',
            background: 'var(--accent)', color: '#fff', cursor: 'pointer',
            fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
          }}>
          Save
        </button>
        {saved && (
          <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>✓ Saved</span>
        )}
      </div>
    </div>
  );
}

function PortSection({ inputStyle, labelStyle, sectionStyle }) {
  const [currentPort, setCurrentPort] = useState('');
  const [newPort, setNewPort] = useState('');
  const [devMode, setDevMode] = useState(false);
  const [status, setStatus] = useState(null); // null | 'saving' | 'restarting' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        setCurrentPort(String(data.port));
        setNewPort(String(data.port));
        setDevMode(!!data.devMode);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    const port = parseInt(newPort, 10);
    if (!port || port < 1 || port > 65535) {
      setStatus('error'); setErrorMsg('Port must be between 1 and 65535.'); return;
    }
    if (port === parseInt(currentPort, 10)) {
      setStatus('error'); setErrorMsg('Port is already set to this value.'); return;
    }

    setStatus('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus('error'); setErrorMsg(data.error || 'Save failed.'); return; }

      if (devMode) {
        // Dev server can't self-restart; just confirm
        setCurrentPort(String(port));
        setStatus('devinfo');
        return;
      }

      // Production: server will restart; count down then redirect
      setStatus('restarting');
      let secs = 5;
      setCountdown(secs);
      countdownRef.current = setInterval(() => {
        secs -= 1;
        setCountdown(secs);
        if (secs <= 0) {
          clearInterval(countdownRef.current);
          window.location.href = `${window.location.protocol}//${window.location.hostname}:${port}`;
        }
      }, 1000);
    } catch (err) {
      setStatus('error'); setErrorMsg(err.message);
    }
  };

  useEffect(() => () => clearInterval(countdownRef.current), []);

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
        Server Port
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>
        Change the port the application listens on. The server will restart automatically and your browser will be redirected.
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Port</label>
        <input
          style={{ ...inputStyle, width: 120 }}
          type="number"
          min="1" max="65535"
          value={newPort}
          onChange={e => { setNewPort(e.target.value); setStatus(null); }}
          disabled={status === 'restarting'}
        />
      </div>
      {status === 'restarting' && (
        <div style={{ padding: '8px 10px', borderRadius: 4, background: 'rgba(91,155,213,0.1)', border: '1px solid rgba(91,155,213,0.3)', fontSize: 10, color: 'var(--accent)', marginBottom: 10 }}>
          Server restarting… redirecting to port {newPort} in {countdown}s
        </div>
      )}
      {status === 'devinfo' && (
        <div style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', fontSize: 10, color: '#ff9800', marginBottom: 10 }}>
          Dev mode: port saved, but restart the dev server manually to apply it.
        </div>
      )}
      {status === 'error' && (
        <div style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', fontSize: 10, color: '#e53935', marginBottom: 10 }}>
          {errorMsg}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={status === 'saving' || status === 'restarting'}
        style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, padding: '8px 20px', cursor: (status === 'saving' || status === 'restarting') ? 'default' : 'pointer', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', opacity: (status === 'saving' || status === 'restarting') ? 0.5 : 1 }}>
        {status === 'saving' ? 'Saving…' : 'Save & Restart'}
      </button>
    </div>
  );
}

// ─── Direct Takes Tab ────────────────────────────────────────────────────────

// System shortcuts that cannot be assigned to a direct take
const RESERVED_SHORTCUTS = new Set([
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'escape', ' ', 'home', 'end', 'pagedown', 'tab',
  'ctrl+d', 'ctrl+f',
]);

function normalizeShortcut(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null;
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

function DirectTakesTab({ directTakesConfig, onSave }) {
  const [focusIndex, setFocusIndex] = useState(-1);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(null);

  const save = (config) => {
    onSave(config);
    setSavedFlash(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1500);
  };

  const update = (index, field, value) => {
    save(directTakesConfig.map((dt, i) => i === index ? { ...dt, [field]: value } : dt));
  };

  const add = () => {
    const newIndex = directTakesConfig.length;
    save([...directTakesConfig, { recallNumber: '', name: '', shortcut: null }]);
    setFocusIndex(newIndex);
    setTimeout(() => setFocusIndex(-1), 100);
  };

  const remove = (index) => {
    save(directTakesConfig.filter((_, i) => i !== index));
  };

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, flex: 1 }}>
          Configure direct takes that can be triggered from the control view.
          Each entry has a recall number (sent to Mosart) and an optional keyboard shortcut.
        </div>
        <span style={{
          fontSize: 10, color: '#4caf50', marginLeft: 12, flexShrink: 0,
          opacity: savedFlash ? 1 : 0, transition: 'opacity 0.4s',
        }}>✓ Saved</span>
      </div>

      {directTakesConfig.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 6 }}>
          No direct takes configured.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {directTakesConfig.map((dt, index) => (
          <DirectTakeRow
            key={index}
            number={index + 1}
            dt={dt}
            rowIndex={index}
            directTakesConfig={directTakesConfig}
            focusOnMount={index === focusIndex}
            onChangeRecall={v => update(index, 'recallNumber', v)}
            onChangeName={v => update(index, 'name', v)}
            onChangeShortcut={v => update(index, 'shortcut', v)}
            onRemove={() => remove(index)}
          />
        ))}
      </div>

      <button onClick={add}
        style={{ marginTop: 4, width: '100%', padding: '10px', border: '1px dashed var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
        <PlusIcon /> Add Direct Take {directTakesConfig.length > 0 ? `(${directTakesConfig.length})` : ''}
      </button>
    </div>
  );
}

function DirectTakeRow({ number, dt, rowIndex, directTakesConfig, onChangeRecall, onChangeName, onChangeShortcut, onRemove, focusOnMount }) {
  const nameRef = useRef(null);

  const siblingShortcuts = directTakesConfig
    .filter((_, i) => i !== rowIndex)
    .map(d => d.shortcut)
    .filter(Boolean)
    .map(s => s.toLowerCase());

  useEffect(() => {
    if (focusOnMount && nameRef.current) nameRef.current.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
      {/* Number badge */}
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 5px', flexShrink: 0, minWidth: 20, textAlign: 'center' }}>
        {number}
      </span>

      {/* Recall number */}
      <input
        type="text"
        value={dt.recallNumber}
        onChange={e => onChangeRecall(e.target.value)}
        placeholder="Recall #"
        style={{ width: 60, padding: '5px 7px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', flexShrink: 0 }}
      />

      {/* Name */}
      <input
        ref={nameRef}
        value={dt.name}
        onChange={e => onChangeName(e.target.value)}
        placeholder="Name"
        style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', minWidth: 0 }}
      />

      {/* Shortcut capture */}
      <ShortcutCapture value={dt.shortcut} onChange={onChangeShortcut} siblingShortcuts={siblingShortcuts} />

      {/* Remove */}
      <button onClick={onRemove}
        style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', borderRadius: 4, width: 26, height: 26, cursor: 'pointer', color: '#e53935', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <TrashIcon />
      </button>
    </div>
  );
}

function ShortcutCapture({ value, onChange, siblingShortcuts }) {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const errorTimerRef = useRef(null);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setCapturing(false); return; }
      const shortcut = normalizeShortcut(e);
      if (!shortcut) return;
      const key = shortcut.toLowerCase();
      if (RESERVED_SHORTCUTS.has(key)) {
        setCapturing(false);
        setError('Reserved by system');
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setError(''), 2500);
        return;
      }
      if (siblingShortcuts.includes(key)) {
        setCapturing(false);
        setError('Already in use');
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setError(''), 2500);
        return;
      }
      onChange(shortcut);
      setCapturing(false);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, siblingShortcuts, onChange]);

  useEffect(() => () => clearTimeout(errorTimerRef.current), []);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => { setCapturing(true); setError(''); }}
        onBlur={() => setCapturing(false)}
        title={capturing ? 'Press a key combination — Escape to cancel' : 'Click to assign a shortcut'}
        style={{
          width: 84, height: 26, padding: '0 6px',
          border: `1px solid ${error ? 'rgba(229,57,53,0.5)' : capturing ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 4,
          background: capturing ? 'rgba(91,155,213,0.1)' : 'var(--bg)',
          color: capturing ? 'var(--accent)' : value ? 'var(--text-primary)' : 'var(--text-dim)',
          fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          outline: 'none',
          animation: capturing ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {capturing ? 'press key…' : (value || '—')}
      </button>
      {value && !capturing && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => onChange(null)}
          title="Clear shortcut"
          style={{
            position: 'absolute', top: -5, right: -5,
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--border)', border: 'none',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontSize: 10, lineHeight: 1, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}>×</button>
      )}
      {error && (
        <div style={{ position: 'absolute', top: 30, right: 0, fontSize: 9, color: '#e53935', whiteSpace: 'nowrap', background: 'var(--bg)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(229,57,53,0.3)', zIndex: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function PasswordSection({ inputStyle, labelStyle, onChangePassword }) {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const getStoredPassword = () => {
    try { return localStorage.getItem('mosart-admin-password') ?? '1234'; } catch { return '1234'; }
  };

  const handleSave = () => {
    if (current !== getStoredPassword()) {
      setStatus('error'); setErrorMsg('Current password is incorrect.'); return;
    }
    if (!newPw) {
      setStatus('error'); setErrorMsg('New password cannot be empty.'); return;
    }
    if (newPw !== confirm) {
      setStatus('error'); setErrorMsg('Passwords do not match.'); return;
    }
    onChangePassword(newPw);
    setCurrent(''); setNewPw(''); setConfirm('');
    setStatus('ok'); setErrorMsg('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
        Admin Password
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        Change the password required to access this admin page.
      </div>
      <div>
        <label style={labelStyle}>Current Password</label>
        <input style={inputStyle} type="password" value={current} onChange={e => { setCurrent(e.target.value); setStatus(null); }} />
      </div>
      <div>
        <label style={labelStyle}>New Password</label>
        <input style={inputStyle} type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setStatus(null); }} />
      </div>
      <div>
        <label style={labelStyle}>Confirm New Password</label>
        <input style={inputStyle} type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setStatus(null); }} />
      </div>
      {status === 'ok' && (
        <div style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', fontSize: 10, color: '#4caf50' }}>
          Password changed successfully.
        </div>
      )}
      {status === 'error' && (
        <div style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', fontSize: 10, color: '#e53935' }}>
          {errorMsg}
        </div>
      )}
      <div>
        <button onClick={handleSave}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, padding: '8px 20px', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
          Change Password
        </button>
      </div>
    </div>
  );
}
