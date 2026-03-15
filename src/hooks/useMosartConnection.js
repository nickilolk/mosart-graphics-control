import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createMosartApi, getField, getContinueCount, isVersionAtLeast } from '../services/mosartApi.js';

/** How long action errors (take in/out failures) stay visible before auto-dismiss. */
const ACTION_ERROR_MS = 5000;

/**
 * Default polling intervals in milliseconds.
 * Timeline is polled fast (current story changes on every take).
 * Graphics/rundown are polled slower (only change on rundown edits).
 */
const DEFAULT_TIMELINE_POLL_MS = 500;
const DEFAULT_GRAPHICS_POLL_MS = 1500;

/** Set to true in the browser console via:  window.__MOSART_DEBUG = true */
const debug = (...args) => {
  if (typeof window !== 'undefined' && window.__MOSART_DEBUG) {
    console.log('[mosart-debug]', ...args);
  }
};

/**
 * useMosartConnection — manages the full lifecycle of a Mosart server connection.
 *
 * Polls graphics, timeline, and rundown from the Mosart REST API.
 * Provides takeIn (fire a graphic) and takeAllOut (control command per handler).
 */
export function useMosartConnection(serverConfig, { timelinePollMs = DEFAULT_TIMELINE_POLL_MS, graphicsPollMs = DEFAULT_GRAPHICS_POLL_MS, enableOnAirStatus = true } = {}) {
  const [graphics, setGraphics] = useState([]);
  const [onAirIds, setOnAirIds] = useState(new Set());
  const [timeline, setTimeline] = useState(null);
  const [rundownName, setRundownName] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [connectionError, setConnectionError] = useState(null);
  const [buildInfo, setBuildInfo] = useState(null);
  const [actionError, setActionError] = useState(null);
  const actionErrorTimer = useRef(null);

  const storyLookupRef = useRef({});
  const apiRef = useRef(null);
  const graphicsFingerprintRef = useRef('');
  const timelineFingerprintRef = useRef('');
  const onAirFingerprintRef = useRef('');

  // In-flight guards — prevent request pileup when the server is slow.
  // Without these, setInterval fires new requests while old ones are still
  // pending, eventually exhausting the browser's connection pool (ERR_INSUFFICIENT_RESOURCES).
  const timelineInFlightRef = useRef(false);
  const graphicsInFlightRef = useRef(false);
  const rundownInFlightRef = useRef(false);
  const onAirInFlightRef = useRef(false);

  // Set to true after init confirms server is running ≥ 5.14 (when the onair endpoint exists).
  const supportsOnAirApiRef = useRef(false);

  // Keep a ref so takeAllOut can access current graphics without dependency
  const graphicsRef = useRef(graphics);
  graphicsRef.current = graphics;

  /** Show a temporary action error that auto-dismisses. */
  const showActionError = useCallback((msg) => {
    setActionError(msg);
    clearTimeout(actionErrorTimer.current);
    actionErrorTimer.current = setTimeout(() => setActionError(null), ACTION_ERROR_MS);
  }, []);

  // Clean up timer on unmount
  useEffect(() => () => clearTimeout(actionErrorTimer.current), []);

  // Merge both error sources into a single value for the UI
  const error = useMemo(() => actionError || connectionError, [actionError, connectionError]);

  // Create API client on mount
  useEffect(() => {
    apiRef.current = createMosartApi(serverConfig);
  }, [serverConfig]);

  // Clear on-air state immediately when the feature is disabled
  useEffect(() => {
    if (!enableOnAirStatus) {
      setOnAirIds(new Set());
      onAirFingerprintRef.current = '';
    }
  }, [enableOnAirStatus]);

  /**
   * Fetch and process the graphics list.
   */
  const fetchGraphics = useCallback(async () => {
    if (!apiRef.current || graphicsInFlightRef.current) return;
    graphicsInFlightRef.current = true;
    try {
      const rawGraphics = await apiRef.current.getGraphics();
      if (!rawGraphics) return;

      const lookup = storyLookupRef.current;

      // Filter out graphics from "shadow" stories (same slug as a paged story
      // but no pageNumber — these are duplicate story entries in the rundown).
      const filtered = rawGraphics.filter(g => !lookup[g.storyId]?.isShadow);

      const processed = filtered.map(g => ({
        ...g,
        storySlug: lookup[g.storyId]?.slug || '(unknown story)',
        storyPageNumber: lookup[g.storyId]?.pageNumber || '',
        storyIndex: lookup[g.storyId]?.index ?? Infinity,
        continueCount: getContinueCount(g),
        tcDur: getField(g, 'tc_dur') || '',
        thumbnailUri: getField(g, 'thumbnailuri') || '',
        payloadUri: getField(g, 'payloaduri') || '',
      }));

      // Sort graphics by their story's position in the rundown so they
      // appear in the same order as the rundown, not the API return order.
      processed.sort((a, b) => a.storyIndex - b.storyIndex);

      // Only update state if the data actually changed — avoids re-rendering
      // ~70 GraphicBadge components every 1.5s when nothing changed.
      const fingerprint = processed.map(g => `${g.id}:${g.status}`).join('|');
      if (fingerprint !== graphicsFingerprintRef.current) {
        graphicsFingerprintRef.current = fingerprint;
        setGraphics(processed);
      }
      setConnectionStatus('connected');
      setConnectionError(null);
    } catch (err) {
      console.error('Failed to fetch graphics:', err);
      setConnectionStatus('error');
      setConnectionError(err.message);
    } finally {
      graphicsInFlightRef.current = false;
    }
  }, []);


  /**
   * Fetch on-air graphics (5.14+ only) and update the onAirIds set.
   * Non-fatal — if the endpoint fails we just leave the previous state.
   */
  const fetchOnAirGraphics = useCallback(async () => {
    if (!apiRef.current || !supportsOnAirApiRef.current || onAirInFlightRef.current || !enableOnAirStatus) return;
    onAirInFlightRef.current = true;
    try {
      const onAir = await apiRef.current.getOnAirGraphics();
      const ids = onAir ? onAir.map(g => g.id) : [];
      const fingerprint = [...ids].sort().join('|');
      if (fingerprint !== onAirFingerprintRef.current) {
        onAirFingerprintRef.current = fingerprint;
        setOnAirIds(new Set(ids));
      }
    } catch (err) {
      console.warn('Failed to fetch on-air graphics:', err?.message || err);
    } finally {
      onAirInFlightRef.current = false;
    }
  }, [enableOnAirStatus]);

  /**
   * Fetch the timeline (current/next story).
   */
  const prevTimelineRef = useRef(null);

  const fetchTimeline = useCallback(async () => {
    if (!apiRef.current || timelineInFlightRef.current) return;
    timelineInFlightRef.current = true;
    try {
      const tl = await apiRef.current.getTimeline();
      // If the timeline item or story changed, immediately re-poll graphics
      // so status updates are picked up as fast as possible.
      const prev = prevTimelineRef.current;
      if (prev && tl && (
        prev.currentItem?.id !== tl.currentItem?.id ||
        prev.currentStory?.id !== tl.currentStory?.id
      )) {
        debug('Timeline changed — triggering immediate graphics re-poll');
        fetchGraphics();
        fetchOnAirGraphics();
      }
      prevTimelineRef.current = tl;

      // Only update state if timeline data actually changed.
      const tlFingerprint = `${tl?.status}|${tl?.currentStory?.id}|${tl?.currentItem?.id}|${tl?.nextStory?.id}|${tl?.nextItem?.id}`;
      if (tlFingerprint !== timelineFingerprintRef.current) {
        timelineFingerprintRef.current = tlFingerprint;
        setTimeline(tl);
      }
      setConnectionStatus('connected');
      setConnectionError(null);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
      setConnectionStatus('error');
      setConnectionError(err.message);
    } finally {
      timelineInFlightRef.current = false;
    }
  }, [fetchGraphics, fetchOnAirGraphics]);

  /**
   * Fetch the rundown to build the story lookup (storyId → slug).
   */
  const fetchRundown = useCallback(async () => {
    if (!apiRef.current || rundownInFlightRef.current) return;
    rundownInFlightRef.current = true;
    try {
      const rundown = await apiRef.current.getRundown();
      if (!rundown) return;

      setRundownName(rundown.name || '');

      const lookup = {};
      // Track which slugs have a "real" story (one with a pageNumber).
      // Shadow stories (same slug, no pageNumber) are duplicates that should
      // be filtered out of the graphics list.
      const slugHasPage = {};
      const storyList = rundown.stories || [];
      for (const story of storyList) {
        if (story.pageNumber) slugHasPage[story.slug] = true;
      }
      for (let i = 0; i < storyList.length; i++) {
        const story = storyList[i];
        lookup[story.id] = {
          slug: story.slug,
          pageNumber: story.pageNumber || '',
          index: i,
          isShadow: !story.pageNumber && slugHasPage[story.slug] === true,
        };
      }
      storyLookupRef.current = lookup;
    } catch (err) {
      console.error('Failed to fetch rundown:', err);
    } finally {
      rundownInFlightRef.current = false;
    }
  }, []);

  // Initial fetch + start polling.
  // Handles Chrome background-tab throttling: when the tab is hidden, setInterval
  // gets clamped to ~1 min. We detect when the tab becomes visible again and
  // immediately re-fetch all data so the UI catches up instantly.
  // We also acquire a Web Lock to prevent Chrome from discarding the tab entirely.
  useEffect(() => {
    let timelinePollId;
    let graphicsPollId;

    async function init() {
      await fetchRundown();
      await Promise.all([fetchGraphics(), fetchTimeline()]);
      // Fetch server build/version info (optional)
      try {
        const b = await apiRef.current.getBuild();
        setBuildInfo(b || null);
        supportsOnAirApiRef.current = isVersionAtLeast(b?.version, '5.14.0');
      } catch (err) {
        // Non-fatal — some older servers may not expose the newer route.
        console.warn('Failed to fetch Mosart build info:', err?.message || err);
        setBuildInfo(null);
      }

      fetchOnAirGraphics();

      timelinePollId = setInterval(fetchTimeline, timelinePollMs);
      graphicsPollId = setInterval(() => {
        fetchRundown();
        fetchGraphics();
        fetchOnAirGraphics();
      }, graphicsPollMs);
    }

    // When the tab comes back from background, immediately re-sync.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        debug('Tab became visible — re-syncing data');
        fetchRundown();
        fetchGraphics();
        fetchTimeline();
        fetchOnAirGraphics();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Acquire a Web Lock to prevent Chrome from discarding (unloading) this tab.
    // The lock is held for the lifetime of this effect via an indefinitely-pending promise.
    let lockResolve;
    if (navigator.locks) {
      navigator.locks.request('mosart-keep-alive', () => {
        return new Promise((resolve) => { lockResolve = resolve; });
      }).catch(() => {}); // silently ignore if lock can't be acquired
    }

    init();

    return () => {
      clearInterval(timelinePollId);
      clearInterval(graphicsPollId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (lockResolve) lockResolve(); // release the Web Lock
    };
  }, [fetchGraphics, fetchTimeline, fetchRundown, fetchOnAirGraphics, timelinePollMs, graphicsPollMs]);

  /**
   * Take in (trigger) a graphic by its Mosart item ID.
   */
  const takeIn = useCallback(async (mosartItemId) => {
    if (!apiRef.current) return;
    try {
      debug(`takeIn("${mosartItemId}")`);
      await apiRef.current.takeIn(mosartItemId);
    } catch (err) {
      console.error('Take IN failed:', err);
      showActionError(`Take IN failed: ${err.message}`);
    }
  }, []);

  /**
   * Take out a graphic by its Mosart item ID.
   */
  const takeOut = useCallback(async (mosartItemId) => {
    if (!apiRef.current) return;
    try {
      debug(`takeOut("${mosartItemId}")`);
      await apiRef.current.takeOut(mosartItemId);
    } catch (err) {
      console.error('Take OUT failed:', err);
      showActionError(`Take OUT failed: ${err.message}`);
    }
  }, []);

  /**
   * Take out all on-air graphics via OVERLAY_GRAPHICS control command.
   * Collects unique handler names from rundown graphics AND any extraHandlers
   * passed in (e.g. from the admin-configured handler list, to cover graphics
   * taken in within the last poll cycle that aren't in graphicsRef yet).
   * DSK is always included.
   * Uses Promise.allSettled so one handler failure doesn't suppress others.
   * @param {string[]} extraHandlers - additional handler names to always include
   */
  const takeAllOut = useCallback(async (extraHandlers = []) => {
    if (!apiRef.current) return;
    try {
      // Start with DSK + any caller-supplied handlers, then add all from rundown
      const handlers = new Set(['DSK', ...extraHandlers.filter(Boolean)]);
      for (const g of graphicsRef.current) {
        if (g.handlerName) handlers.add(g.handlerName);
      }

      debug('takeAllOut — sending OVERLAY_GRAPHICS TAKE_ALL_OUT to destinations:', [...handlers]);

      const results = await Promise.allSettled(
        [...handlers].map(destination =>
          apiRef.current.controlCommand('OVERLAY_GRAPHICS', {
            Action: 'TAKE_ALL_OUT',
            parameter: destination,
          })
        )
      );

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        const reasons = failures.map(f => f.reason?.message || 'unknown error').join('; ');
        console.error('Take ALL OUT: some handlers failed:', reasons);
        showActionError(`Take ALL OUT: ${failures.length} handler(s) failed — ${reasons}`);
      }
    } catch (err) {
      console.error('Take ALL OUT failed:', err);
      showActionError(`Take ALL OUT failed: ${err.message}`);
    }
  }, [showActionError]);

  /**
   * Send CONTINUE command to advance through continue points on the current graphic.
   */
  const continueGraphic = useCallback(async () => {
    if (!apiRef.current) return;
    try {
      debug('continueGraphic — OVERLAY_GRAPHICS CONTINUE Current');
      await apiRef.current.controlCommand('OVERLAY_GRAPHICS', {
        Action: 'CONTINUE',
        Render: 'Current',
      });
    } catch (err) {
      console.error('Continue failed:', err);
      showActionError(`Continue failed: ${err.message}`);
    }
  }, []);

  /**
   * Trigger a template by type and variant.
   */
  const triggerTemplate = useCallback(async (type, variant) => {
    if (!apiRef.current) return;
    try {
      debug(`triggerTemplate("${type}", "${variant}")`);
      await apiRef.current.triggerTemplate(type, variant);
    } catch (err) {
      console.error('Template trigger failed:', err);
      showActionError(`Template failed: ${err.message}`);
    }
  }, []);

  /** Dismiss the current error banner. */
  const dismissError = useCallback(() => {
    setConnectionError(null);
    setActionError(null);
    clearTimeout(actionErrorTimer.current);
  }, []);

  /** Look up a story's rundown index by its ID. Returns -1 if not found. */
  const getStoryRundownIndex = useCallback((storyId) => {
    return storyLookupRef.current[storyId]?.index ?? -1;
  }, []);

  return {
    graphics,
    onAirIds,
    timeline,
    rundownName,
    buildInfo,
    connectionStatus,
    error,
    dismissError,
    getStoryRundownIndex,
    takeIn,
    takeOut,
    takeAllOut,
    continueGraphic,
    triggerTemplate,
  };
}
