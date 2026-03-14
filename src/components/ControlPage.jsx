import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMosartConnection } from '../hooks/useMosartConnection.js';
import { isVersionAtLeast, parseVersion } from '../services/mosartApi.js';
import { FIXED_WIDTH } from '../styles/theme.js';
import { KeyboardIcon, DisconnectIcon, SettingsIcon } from './Icons.jsx';
import GraphicBadge from './GraphicBadge.jsx';
import { ShortcutsModal, DisconnectModal } from './Modals.jsx';

export default function ControlPage({ server, onDisconnect, darkMode, onToggleDarkMode, showHandler, onToggleShowHandler, showContinuePoints, onToggleShowContinuePoints, showThumbnails, onToggleShowThumbnails, showContinueButton, onToggleShowContinueButton, handlerConfig, pollConfig, inactivityMinutes }) {
  const {
    graphics,
    onAirIds,
    timeline,
    connectionStatus,
    error,
    dismissError,
    getStoryRundownIndex,
    takeIn,
    takeOut,
    takeAllOut,
    continueGraphic,
    buildInfo,
  } = useMosartConnection(server, pollConfig);
  const buildVersion = buildInfo?.version || null;
  const displayVersion = buildVersion ? ('v' + parseVersion(buildVersion).slice(0, 3).join('.')) : null;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const listRef = useRef(null);

  // Build a map of handlerName → configured color (only when handlers are configured)
  const handlerColorMap = useMemo(() => {
    if (!handlerConfig || handlerConfig.length === 0) return null;
    const map = new Map();
    handlerConfig.forEach(h => { if (h.name) map.set(h.name, h.color); });
    return map;
  }, [handlerConfig]);

  // Filter graphics by configured handlers (empty config = show all)
  const filteredGraphics = useMemo(() => {
    if (!handlerColorMap || handlerColorMap.size === 0) return graphics;
    return graphics.filter(g => handlerColorMap.has(g.handlerName));
  }, [graphics, handlerColorMap]);

  // Group graphics by story for rendering (Map preserves insertion order
  // and merges non-contiguous graphics from the same story into one group)
  const { storyGroups, visualOrder } = useMemo(() => {
    const groupMap = new Map();
    filteredGraphics.forEach((gfx) => {
      let group = groupMap.get(gfx.storyId);
      if (!group) {
        group = { storyId: gfx.storyId, storySlug: gfx.storySlug, storyPageNumber: gfx.storyPageNumber, items: [] };
        groupMap.set(gfx.storyId, group);
      }
      group.items.push(gfx);
    });
    const groups = [...groupMap.values()];
    // Flat list in visual (grouped) order — selectedIndex indexes into this
    const order = groups.flatMap(g => g.items);
    return { storyGroups: groups, visualOrder: order };
  }, [filteredGraphics]);

  // Cue to first graphic in the current on-air story.
  // If the current story has no graphics, find the nearest previous story that does.
  const cueToOnAirStory = useCallback(() => {
    if (!timeline?.currentStory?.id) return;

    let targetIdx = visualOrder.findIndex(g => g.storyId === timeline.currentStory.id);

    if (targetIdx < 0) {
      // Current story has no graphics — find the closest preceding story with graphics.
      const currentRundownIdx = getStoryRundownIndex(timeline.currentStory.id);
      if (currentRundownIdx >= 0) {
        // Walk backwards through visualOrder to find the last graphic whose story
        // is at or before the current story in the rundown.
        let bestFirst = -1;
        for (let i = visualOrder.length - 1; i >= 0; i--) {
          if (visualOrder[i].storyIndex <= currentRundownIdx) {
            // Found a graphic before/at current position — find the first graphic in that story
            const storyId = visualOrder[i].storyId;
            bestFirst = visualOrder.findIndex(g => g.storyId === storyId);
            break;
          }
        }
        targetIdx = bestFirst;
      }
    }

    if (targetIdx >= 0) {
      setSelectedIndex(targetIdx);
      const targetStoryId = visualOrder[targetIdx].storyId;
      requestAnimationFrame(() => {
        const storyEl = listRef.current?.querySelector(`[data-story="${targetStoryId}"]`);
        if (storyEl) storyEl.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    }
  }, [visualOrder, getStoryRundownIndex, timeline]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (showShortcuts || showDisconnect || showSettings) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, visualOrder.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const gfx = visualOrder[selectedIndex];
        if (gfx) takeIn(gfx.id);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const gfx = visualOrder[selectedIndex];
        if (gfx) takeOut(gfx.id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        takeAllOut(handlerConfig?.map(h => h.name) ?? []);
      } else if (e.key === ' ') {
        e.preventDefault();
        cueToOnAirStory();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSelectedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedIndex(visualOrder.length - 1);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        continueGraphic();
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        onToggleDarkMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visualOrder, selectedIndex, showShortcuts, showDisconnect, showSettings, takeIn, takeOut, takeAllOut, continueGraphic, cueToOnAirStory, onToggleDarkMode, handlerConfig]);

  // Inactivity auto-logout
  useEffect(() => {
    if (!inactivityMinutes || inactivityMinutes <= 0) return;
    const timeoutMs = inactivityMinutes * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onDisconnect, timeoutMs);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [inactivityMinutes, onDisconnect]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [selectedIndex]);

  // Clamp selectedIndex when graphics list changes
  useEffect(() => {
    if (selectedIndex >= visualOrder.length && visualOrder.length > 0) {
      setSelectedIndex(visualOrder.length - 1);
    }
  }, [visualOrder.length, selectedIndex]);

  // Connection status color
  const statusDotColor =
    connectionStatus === 'connected' ? '#4caf50' :
    connectionStatus === 'connecting' ? '#ff9800' : '#e53935';

  // Track the visual index as we render story groups
  let visualIdx = 0;

  return (
    <div style={{ width: FIXED_WIDTH, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ===== TOP BAR ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: statusDotColor,
            boxShadow: connectionStatus === 'connected' ? '0 0 6px rgba(76,175,80,0.5)' : 'none',
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{server.name}</span>
          <span style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 3, fontWeight: 600,
            background: timeline?.status === 'Running' ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.15)',
            color: timeline?.status === 'Running' ? '#4caf50' : '#ff9800',
          }}>
            {timeline?.status || connectionStatus}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {displayVersion && (
            <span style={{ fontSize: 12, fontWeight: 700, marginRight: 4, color: isVersionAtLeast(buildVersion, '5.13.0') ? '#4caf50' : '#e53935' }} title={`Mosart ${buildVersion}`}>
              {displayVersion}
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowSettings(v => !v)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, height: 28, padding: '0 6px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
              title="Settings">
              <SettingsIcon />
            </button>
            {showSettings && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowSettings(false)} />
                <div style={{
                  position: 'absolute', top: 34, right: 0, width: 200,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 6, zIndex: 50,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  <ThemeSwitch darkMode={darkMode} onToggle={onToggleDarkMode} />
                  <SettingsToggle label="Show Handler" checked={showHandler} onChange={onToggleShowHandler} />
                  <SettingsToggle label="Show Continue Points" checked={showContinuePoints} onChange={onToggleShowContinuePoints} />
                  <SettingsToggle label="Show Continue Button" checked={showContinueButton} onChange={onToggleShowContinueButton} />
                  {/* TODO: Re-enable once Preview Server thumbnails are tested on-network */}
                  {/* <SettingsToggle label="Show Thumbnails" checked={showThumbnails} onChange={onToggleShowThumbnails} /> */}
                </div>
              </>
            )}
          </div>
          <button onClick={() => setShowShortcuts(true)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, height: 28, padding: '0 6px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
            title="Keyboard Shortcuts">
            <KeyboardIcon />
          </button>
          <button onClick={() => setShowDisconnect(true)}
            style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', borderRadius: 4, height: 28, padding: '0 8px', cursor: 'pointer', color: '#e53935', display: 'flex', alignItems: 'center', fontFamily: 'inherit' }}>
            <DisconnectIcon />
          </button>
        </div>
      </div>

      {/* ===== ERROR BANNER ===== */}
      {error && (
        <div style={{
          padding: '6px 12px', background: 'rgba(229,57,53,0.1)',
          borderBottom: '1px solid rgba(229,57,53,0.3)',
          fontSize: 11, color: '#e53935', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{error}</span>
          <button onClick={dismissError} style={{
            background: 'none', border: 'none', color: '#e53935', cursor: 'pointer',
            fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0, fontFamily: 'inherit',
          }} title="Dismiss">✕</button>
        </div>
      )}

      {/* ===== FIXED TOP: On-Air Story Info ===== */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-dim)',
        }}>
          <span>ON AIR:</span>
          <span style={{ color: '#fdd835', fontWeight: 600, letterSpacing: 0.5, textTransform: 'none', fontSize: 12 }}>
            {timeline?.currentStory?.slug || '—'}
          </span>
        </div>
      </div>

      {/* ===== SCROLLABLE GRAPHICS LIST ===== */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredGraphics.length === 0 && connectionStatus === 'connected' && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            No overlay graphics in the current rundown.
          </div>
        )}
        {filteredGraphics.length === 0 && connectionStatus === 'connecting' && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            Connecting to {server.name}...
          </div>
        )}
        {storyGroups.map((group, gi) => {
          const isCurrentStory = group.storyId === timeline?.currentStory?.id;
          const groupStartIdx = visualIdx;
          return (
            <div key={group.storyId || gi} data-story={group.storyId} style={{
              background: isCurrentStory ? 'rgba(253, 216, 53, 0.13)' : 'transparent',
              borderRadius: isCurrentStory ? 6 : 0,
              padding: isCurrentStory ? '2px 6px 6px' : '0',
              marginTop: gi > 0 ? 4 : 0,
            }}>
              <div style={{
                fontSize: 11, color: isCurrentStory ? '#fdd835' : 'var(--text-dim)',
                padding: '6px 4px 3px', fontWeight: isCurrentStory ? 700 : 400,
                letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4,
                borderTop: gi > 0 && !isCurrentStory ? '1px solid var(--border)' : 'none',
              }}>
                {isCurrentStory && <span style={{ fontSize: 6 }}>●</span>}
                {group.storyPageNumber && <span style={{
                  fontSize: 10, fontWeight: 600, color: isCurrentStory ? '#fdd835' : '#fff',
                  background: isCurrentStory ? 'rgba(253,216,53,0.15)' : 'rgba(255,255,255,0.08)',
                  padding: '1px 5px', borderRadius: 3, minWidth: 20, textAlign: 'center',
                }}>{group.storyPageNumber}</span>}
                {group.storySlug}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items.map((gfx, itemIdx) => {
                  const vi = groupStartIdx + itemIdx;
                  visualIdx = vi + 1;
                  return (
                    <div key={gfx.id} data-index={vi} onClick={() => setSelectedIndex(vi)}>
                      <GraphicBadge
                        gfx={gfx}
                        isSelected={selectedIndex === vi}
                        isOnAir={onAirIds.has(gfx.id)}
                        showHandler={showHandler}
                        showContinuePoints={showContinuePoints}
                        showContinueButton={showContinueButton}
                        showThumbnails={showThumbnails}
                        onTakeIn={takeIn}
                        onTakeOut={takeOut}
                        onContinue={continueGraphic}
                        handlerColor={handlerColorMap?.get(gfx.handlerName)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== MODALS ===== */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showDisconnect && <DisconnectModal serverName={server.name} onConfirm={onDisconnect} onCancel={() => setShowDisconnect(false)} />}
    </div>
  );
}

function ThemeSwitch({ darkMode, onToggle }) {
  const btnStyle = (active) => ({
    flex: 1, padding: '5px 0', border: 'none', borderRadius: 4, cursor: 'pointer',
    fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#000' : 'var(--text-dim)',
  });
  return (
    <div style={{ display: 'flex', gap: 2, padding: '4px 6px', background: 'var(--surface)', borderRadius: 6, margin: '0 4px 4px' }}>
      <button onClick={darkMode ? onToggle : undefined} style={btnStyle(!darkMode)}>Light</button>
      <button onClick={!darkMode ? onToggle : undefined} style={btnStyle(darkMode)}>Dark</button>
    </div>
  );
}

function SettingsToggle({ label, checked, onChange }) {
  return (
    <button onClick={onChange}
      style={{
        width: '100%', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer',
        color: 'var(--text-primary)', fontSize: 11, fontFamily: 'inherit',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      <span>{label}</span>
      <span style={{ color: checked ? 'var(--accent)' : 'var(--text-dim)', fontSize: 10 }}>{checked ? '✓' : '○'}</span>
    </button>
  );
}
