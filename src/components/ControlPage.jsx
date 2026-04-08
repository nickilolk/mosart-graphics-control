import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMosartConnection } from '../hooks/useMosartConnection.js';
import { isVersionAtLeast, parseVersion } from '../services/mosartApi.js';
import { FIXED_WIDTH } from '../styles/theme.js';
import { KeyboardIcon, DisconnectIcon, SettingsIcon, CollectionIcon } from './Icons.jsx';
import GraphicBadge from './GraphicBadge.jsx';
import { ShortcutsModal, DisconnectModal } from './Modals.jsx';

export default function ControlPage({ server, onDisconnect, darkMode, onToggleDarkMode, showHandler, onToggleShowHandler, showContinuePoints, onToggleShowContinuePoints, showThumbnails, onToggleShowThumbnails, showContinueButton, onToggleShowContinueButton, showOnAirStatus, onToggleShowOnAirStatus, showDirectTakes, onToggleShowDirectTakes, handlerConfig, directTakesConfig, pollConfig, inactivityMinutes }) {
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
  } = useMosartConnection(server, { ...pollConfig, enableOnAirStatus: showOnAirStatus });
  const buildVersion = buildInfo?.version || null;
  const displayVersion = buildVersion ? ('v' + parseVersion(buildVersion).slice(0, 3).join('.')) : null;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('main'); // 'main' | 'collection'
  const [collectionSelectedIndex, setCollectionSelectedIndex] = useState(0);
  const [collection, setCollection] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mosart-collection') || '[]'); }
    catch { return []; }
  });
  const listRef = useRef(null);
  const collectionListRef = useRef(null);
  const searchRef = useRef(null);

  // Persist collection to localStorage
  useEffect(() => {
    localStorage.setItem('mosart-collection', JSON.stringify(collection));
  }, [collection]);

  // Reset to main panel when collection closes
  useEffect(() => {
    if (!collectionOpen) setActivePanel('main');
  }, [collectionOpen]);

  const addToCollection = useCallback((gfx) => {
    setCollection(prev => prev.some(g => g.id === gfx.id) ? prev : [...prev, gfx]);
  }, []);

  const removeFromCollection = useCallback((id) => {
    setCollection(prev => prev.filter(g => g.id !== id));
  }, []);

  const clearCollection = useCallback(() => setCollection([]), []);

  const [filters, setFilters] = useState({ manualIn: false, autoIn: false, backgroundEnd: false, storyEnd: false, nonAutoOut: false });
  const [searchText, setSearchText] = useState('');
  const toggleFilter = useCallback((key) => setFilters(prev => ({ ...prev, [key]: !prev[key] })), []);
  const clearFilters = useCallback(() => { setFilters({ manualIn: false, autoIn: false, backgroundEnd: false, storyEnd: false, nonAutoOut: false }); setSearchText(''); }, []);
  const hasActiveFilters = Object.values(filters).some(Boolean) || searchText.trim() !== '';

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

  // Apply type toggles + text search on top of handler filtering
  const displayedGraphics = useMemo(() => {
    let result = filteredGraphics;
    const active = [];
    if (filters.manualIn)      active.push(g => !g.fields?.find(f => f.name === 'tc_in')?.value);
    if (filters.autoIn)        active.push(g => !!g.fields?.find(f => f.name === 'tc_in')?.value);
    if (filters.backgroundEnd) active.push(g => g.graphicType === 'BACKGROUNDEND');
    if (filters.storyEnd)      active.push(g => g.graphicType === 'STORYEND');
    if (filters.nonAutoOut)    active.push(g => g.graphicType === 'MANUAL');
    if (active.length > 0) result = result.filter(g => active.some(fn => fn(g)));
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(g => g.slug?.toLowerCase().includes(q));
    }
    return result;
  }, [filteredGraphics, filters, searchText]);

  // Group graphics by story for rendering
  const { storyGroups, visualOrder } = useMemo(() => {
    const groupMap = new Map();
    displayedGraphics.forEach((gfx) => {
      let group = groupMap.get(gfx.storyId);
      if (!group) {
        group = { storyId: gfx.storyId, storySlug: gfx.storySlug, storyPageNumber: gfx.storyPageNumber, items: [] };
        groupMap.set(gfx.storyId, group);
      }
      group.items.push(gfx);
    });
    const groups = [...groupMap.values()];
    const order = groups.flatMap(g => g.items);
    return { storyGroups: groups, visualOrder: order };
  }, [displayedGraphics]);

  // TODO: replace with real API call once Mosart direct-take endpoint is confirmed
  const triggerDirectTake = useCallback((dt) => {
    console.log('Direct take triggered — recall:', dt.recallNumber, 'name:', dt.name);
  }, []);

  const cueToOnAirStory = useCallback(() => {
    if (!timeline?.currentStory?.id) return;

    let targetIdx = visualOrder.findIndex(g => g.storyId === timeline.currentStory.id);

    if (targetIdx < 0) {
      const currentRundownIdx = getStoryRundownIndex(timeline.currentStory.id);
      if (currentRundownIdx >= 0) {
        let bestFirst = -1;
        for (let i = visualOrder.length - 1; i >= 0; i--) {
          if (visualOrder[i].storyIndex <= currentRundownIdx) {
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

      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      // Escape blurs the search input (before the early-return guard below)
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        e.preventDefault();
        searchRef.current.blur();
        return;
      }

      // Don't fire navigation shortcuts while typing in the search input
      if (document.activeElement === searchRef.current) return;

      if (e.key === 'Tab' && collectionOpen) {
        e.preventDefault();
        setActivePanel(prev => prev === 'main' ? 'collection' : 'main');
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activePanel === 'collection') {
          setCollectionSelectedIndex(prev => Math.min(prev + 1, collection.length - 1));
        } else {
          setSelectedIndex(prev => Math.min(prev + 1, visualOrder.length - 1));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activePanel === 'collection') {
          setCollectionSelectedIndex(prev => Math.max(prev - 1, 0));
        } else {
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (activePanel === 'collection') {
          const gfx = collection[collectionSelectedIndex];
          if (gfx) takeIn(gfx.id);
        } else {
          const gfx = visualOrder[selectedIndex];
          if (gfx) takeIn(gfx.id);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (activePanel === 'collection') {
          const gfx = collection[collectionSelectedIndex];
          if (gfx) takeOut(gfx.id);
        } else {
          const gfx = visualOrder[selectedIndex];
          if (gfx) takeOut(gfx.id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        takeAllOut(handlerConfig?.map(h => h.name) ?? []);
      } else if (e.key === ' ') {
        e.preventDefault();
        cueToOnAirStory();
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (activePanel === 'collection') {
          setCollectionSelectedIndex(0);
        } else {
          setSelectedIndex(0);
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        if (activePanel === 'collection') {
          setCollectionSelectedIndex(Math.max(0, collection.length - 1));
        } else {
          setSelectedIndex(visualOrder.length - 1);
        }
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        continueGraphic();
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        onToggleDarkMode();
      } else if (directTakesConfig?.length) {
        const match = directTakesConfig.find(dt => dt.shortcut && matchesShortcut(e, dt.shortcut));
        if (match) {
          e.preventDefault();
          triggerDirectTake(match);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visualOrder, selectedIndex, collection, collectionSelectedIndex, activePanel, collectionOpen, showShortcuts, showDisconnect, showSettings, takeIn, takeOut, takeAllOut, continueGraphic, cueToOnAirStory, onToggleDarkMode, handlerConfig, directTakesConfig]);

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

  // Scroll selected item into view — main list
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [selectedIndex]);

  // Scroll selected item into view — collection
  useEffect(() => {
    if (collectionListRef.current) {
      const el = collectionListRef.current.querySelector(`[data-collection-index="${collectionSelectedIndex}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [collectionSelectedIndex]);

  // Clamp selectedIndex when graphics list changes
  useEffect(() => {
    if (selectedIndex >= visualOrder.length && visualOrder.length > 0) {
      setSelectedIndex(visualOrder.length - 1);
    }
  }, [visualOrder.length, selectedIndex]);

  // Clamp collectionSelectedIndex when collection changes
  useEffect(() => {
    if (collectionSelectedIndex >= collection.length && collection.length > 0) {
      setCollectionSelectedIndex(collection.length - 1);
    }
  }, [collection.length, collectionSelectedIndex]);

  const statusDotColor =
    connectionStatus === 'connected' ? '#4caf50' :
    connectionStatus === 'connecting' ? '#ff9800' : '#e53935';

  const handleCollectionDrop = useCallback((e) => {
    const id = e.dataTransfer.getData('text/plain');
    const gfx = filteredGraphics.find(g => g.id === id);
    if (gfx) addToCollection({ ...gfx });
  }, [filteredGraphics, addToCollection]);

  let visualIdx = 0;

  return (
    <div style={{ width: collectionOpen ? FIXED_WIDTH * 2 + 1 : FIXED_WIDTH, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'row', transition: 'width 0.2s ease' }}>

      {/* ===== MAIN PANEL ===== */}
      <div style={{ width: FIXED_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>

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
                    <SettingsToggle label="Show On-Air Status" checked={showOnAirStatus} onChange={onToggleShowOnAirStatus} />
                    {directTakesConfig?.length > 0 && (
                      <SettingsToggle label="Show Direct Takes" checked={showDirectTakes} onChange={onToggleShowDirectTakes} />
                    )}
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
            <button
              onClick={() => setCollectionOpen(v => !v)}
              style={{ background: collectionOpen ? 'rgba(91,155,213,0.15)' : 'none', border: '1px solid var(--border)', borderRadius: 4, height: 28, padding: '0 6px', cursor: 'pointer', color: collectionOpen ? 'var(--accent)' : 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
              title={collectionOpen ? 'Close Personal Collection' : 'Open Personal Collection'}>
              <CollectionIcon />
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

        {/* ===== FILTER BAR ===== */}
        <FilterBar filters={filters} onToggle={toggleFilter} searchText={searchText} onSearchChange={setSearchText} hasActive={hasActiveFilters} onClear={clearFilters} searchRef={searchRef} />

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
          {filteredGraphics.length > 0 && displayedGraphics.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              No graphics match the current filters.
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
                      <div
                        key={gfx.id}
                        data-index={vi}
                        onClick={() => { setActivePanel('main'); setSelectedIndex(vi); }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', gfx.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        style={{ cursor: 'grab' }}
                      >
                        <GraphicBadge
                          gfx={gfx}
                          isSelected={activePanel === 'main' && selectedIndex === vi}
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

        {showDirectTakes && directTakesConfig?.length > 0 && (
          <DirectTakesDeck directTakesConfig={directTakesConfig} onTrigger={triggerDirectTake} />
        )}

      </div>{/* end main panel */}

      {/* ===== PERSONAL COLLECTION PANEL ===== */}
      {collectionOpen && (
        <PersonalCollection
          collection={collection}
          onAirIds={onAirIds}
          onRemove={removeFromCollection}
          onClear={clearCollection}
          onTakeIn={takeIn}
          onTakeOut={takeOut}
          onContinue={continueGraphic}
          onDrop={handleCollectionDrop}
          onSelectItem={(i) => { setActivePanel('collection'); setCollectionSelectedIndex(i); }}
          selectedIndex={activePanel === 'collection' ? collectionSelectedIndex : -1}
          listRef={collectionListRef}
          showHandler={showHandler}
          showContinuePoints={showContinuePoints}
          showContinueButton={showContinueButton}
          showThumbnails={showThumbnails}
          handlerColorMap={handlerColorMap}
        />
      )}

      {/* ===== MODALS ===== */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} directTakesConfig={directTakesConfig} />}
      {showDisconnect && <DisconnectModal serverName={server.name} onConfirm={onDisconnect} onCancel={() => setShowDisconnect(false)} />}
    </div>
  );
}

function PersonalCollection({ collection, onAirIds, onRemove, onClear, onTakeIn, onTakeOut, onContinue, onDrop, onSelectItem, selectedIndex, listRef, showHandler, showContinuePoints, showContinueButton, showThumbnails, handlerColorMap }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div style={{
      width: FIXED_WIDTH, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, height: 45, boxSizing: 'border-box',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.3 }}>
          Personal Collection
        </span>
        {collection.length > 0 && (
          <button onClick={onClear} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)',
            fontSize: 11, padding: '2px 4px', fontFamily: 'inherit',
          }} title="Clear all">
            Clear all
          </button>
        )}
      </div>

      {/* Drop zone / Items */}
      <div
        ref={listRef}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(e); }}
        style={{
          flex: 1, overflowY: 'auto', padding: '8px 12px 12px',
          display: 'flex', flexDirection: 'column', gap: 4,
          outline: dragOver ? '2px dashed var(--accent)' : '2px dashed transparent',
          outlineOffset: '-6px',
          borderRadius: 4,
          transition: 'outline-color 0.1s',
          background: dragOver ? 'rgba(91,155,213,0.04)' : 'transparent',
        }}>
        {collection.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 8, color: 'var(--text-dim)', textAlign: 'center', pointerEvents: 'none',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            <span style={{ fontSize: 12 }}>Drag graphics here</span>
          </div>
        )}
        {collection.map((gfx, i) => (
          <div
            key={gfx.id}
            data-collection-index={i}
            onClick={() => onSelectItem(i)}
            style={{ position: 'relative' }}
          >
            <GraphicBadge
              gfx={gfx}
              isSelected={selectedIndex === i}
              isOnAir={onAirIds.has(gfx.id)}
              showHandler={showHandler}
              showContinuePoints={showContinuePoints}
              showContinueButton={showContinueButton}
              showThumbnails={showThumbnails}
              onTakeIn={onTakeIn}
              onTakeOut={onTakeOut}
              onContinue={onContinue}
              handlerColor={handlerColorMap?.get(gfx.handlerName)}
            />
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(gfx.id); }}
              title="Remove from collection"
              style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
                width: 16, height: 16, cursor: 'pointer', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, lineHeight: 1, padding: 0, fontFamily: 'inherit',
              }}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function matchesShortcut(e, shortcut) {
  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const key = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return false;
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+').toLowerCase() === shortcut.toLowerCase();
}

function DirectTakesDeck({ directTakesConfig, onTrigger }) {
  if (!directTakesConfig?.length) return null;

  // Split into rows of max 3; buttons in each row share the width equally
  const rows = [];
  for (let i = 0; i < directTakesConfig.length; i += 3) {
    rows.push(directTakesConfig.slice(i, i + 3));
  }

  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 4 }}>
          {row.map((dt, di) => (
            <button
              key={di}
              onClick={() => onTrigger(dt)}
              title={[dt.name || `Recall ${dt.recallNumber}`, dt.shortcut].filter(Boolean).join(' — ')}
              style={{
                flex: 1, minWidth: 0,
                padding: '5px 6px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {dt.name || `Recall ${dt.recallNumber}`}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function FilterBar({ filters, onToggle, searchText, onSearchChange, hasActive, onClear, searchRef }) {
  const textBadge = (active) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 32, height: 18, borderRadius: 3, padding: '0 4px',
    border: 'none', cursor: 'pointer', background: '#f7dd72',
    fontSize: 9, fontWeight: 700, color: '#000', fontFamily: 'inherit',
    opacity: active ? 1 : 0.38,
    outline: active ? '2px solid rgba(197,168,0,0.7)' : '2px solid transparent',
    outlineOffset: 1,
    transition: 'opacity 0.12s, outline-color 0.12s',
  });
  const iconBadge = (active) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
    width: 32, height: 18, borderRadius: 3, padding: '0 3px',
    border: 'none', cursor: 'pointer', background: '#f7dd72', fontFamily: 'inherit',
    opacity: active ? 1 : 0.38,
    outline: active ? '2px solid rgba(197,168,0,0.7)' : '2px solid transparent',
    outlineOffset: 1,
    transition: 'opacity 0.12s, outline-color 0.12s',
  });

  return (
    <div style={{
      padding: '6px 12px', borderBottom: '1px solid var(--border)',
      background: 'var(--surface)', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
    }}>
      {/* Manual In */}
      <button onClick={() => onToggle('manualIn')} style={textBadge(filters.manualIn)} title="Manual In">
        MNL
      </button>

      {/* Auto In */}
      <button onClick={() => onToggle('autoIn')} style={textBadge(filters.autoIn)} title="Auto In">
        AUTO
      </button>

      {/* Background End */}
      <button onClick={() => onToggle('backgroundEnd')} style={iconBadge(filters.backgroundEnd)} title="Background End">
        <svg width="8" height="8"><rect x="0.5" y="0.5" width="7" height="7" fill="none" stroke="#000" strokeWidth="1" /></svg>
      </button>

      {/* Story End */}
      <button onClick={() => onToggle('storyEnd')} style={iconBadge(filters.storyEnd)} title="Story End">
        <svg width="8" height="8"><rect width="8" height="8" fill="#000" /></svg>
      </button>

      {/* Non Auto Out (Manual out) */}
      <button onClick={() => onToggle('nonAutoOut')} style={iconBadge(filters.nonAutoOut)} title="Non Auto Out">
        <svg width="9" height="8"><line x1="0" y1="1" x2="9" y2="1" stroke="#000" strokeWidth="1.5" /><line x1="0" y1="4" x2="9" y2="4" stroke="#000" strokeWidth="1.5" /><line x1="0" y1="7" x2="9" y2="7" stroke="#000" strokeWidth="1.5" /></svg>
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />

      {/* Text search */}
      <input
        ref={searchRef}
        type="text"
        value={searchText}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search…"
        style={{
          flex: 1, minWidth: 80, height: 22, padding: '0 7px',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 3, color: 'var(--text-primary)', fontSize: 11,
          fontFamily: 'inherit', outline: 'none',
        }}
      />

      {/* Clear */}
      {hasActive && (
        <button onClick={onClear} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)',
          fontSize: 11, padding: '0 2px', fontFamily: 'inherit', flexShrink: 0,
        }} title="Clear filters">✕</button>
      )}
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
