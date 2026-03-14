/**
 * mosartApi.js — Viz Mosart REST API service module
 *
 * All HTTP communication with the Mosart Remote Control Service lives here.
 * Endpoints are based on Viz Mosart 5.13 Swagger (port 55167).
 *
 * Usage:
 *   const api = createMosartApi({ host: 'NICKI-DESKTOP-A', port: 55167, apiKey: 'gBnEwS-api' });
 *   const graphics = await api.getGraphics();
 *   await api.takeIn('some-mosart-item-id');
 */

/**
 * Create an API client bound to a specific Mosart server.
 * @param {{ host: string, port: number, apiKey: string }} serverConfig
 * @returns {MosartApi}
 */
export function createMosartApi(serverConfig) {
  const { host, port, apiKey } = serverConfig;
  // Route all API calls through the proxy to avoid CORS issues.
  // Both the Vite dev server and the production server (server.js) handle this route.
  // The proxy reads the target host/port from the URL path: /mosart-proxy/{host}/{port}/...
  const baseUrl = `/mosart-proxy/${encodeURIComponent(host)}/${port}`;

  /**
   * Internal fetch wrapper with API key header and error handling.
   */
  async function request(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Abort requests that take longer than 10s to prevent hanging connections.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(url, { ...options, headers, signal: controller.signal });
    } catch (err) {
      // Network-level failure (server down, DNS, CORS, timeout, etc.)
      throw new MosartApiError(
        `Cannot reach Mosart server (${host}:${port})`,
        0,
        err.name === 'AbortError' ? 'Request timed out' : err.message
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new MosartApiError(
        friendlyHttpError(response.status, host, port),
        response.status,
        detail
      );
    }

    // Some endpoints return empty body (204 No Content or empty 200)
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (err) {
      throw new MosartApiError(
        'Unexpected response from Mosart server (invalid JSON)',
        response.status,
        text.slice(0, 200)
      );
    }
  }

  /**
   * Map HTTP status codes to operator-friendly messages.
   */
  function friendlyHttpError(status, h, p) {
    switch (status) {
      case 400: return 'Bad request sent to Mosart — check command parameters';
      case 401: return `Invalid API key for Mosart server (${h}:${p})`;
      case 403: return `Access denied by Mosart server (${h}:${p})`;
      case 404: return 'Mosart endpoint not found — check server version';
      case 408: return 'Mosart server timed out — it may be busy';
      case 500: return 'Mosart server internal error';
      case 502: return 'Mosart server is unreachable (bad gateway)';
      case 503: return 'Mosart server is unavailable — it may be restarting';
      default:  return `Mosart server error (HTTP ${status})`;
    }
  }

  return {
    /** Get the base URL for display purposes */
    getBaseUrl() {
      return baseUrl;
    },

    // ============================================================
    // STATUS & TIMELINE
    // ============================================================

    /**
     * GET /api/v1/status
     * Returns server state, timeline state, autoTake, rehearsalMode, etc.
     * Note: This endpoint does NOT validate the API key.
     */
    async getStatus() {
      return request('/api/v1/status');
    },

    /**
     * GET /api/v1/timeline
     * Returns: { status, currentStory, nextStory, currentItem, nextItem }
     * Each story/item has { id, slug }.
     */
    async getTimeline() {
      return request('/api/v1/timeline');
    },

    // ============================================================
    // RUNDOWN
    // ============================================================

    /**
     * GET /api/v1/rundown
     * Returns full rundown structure with stories array.
     * Each story: { id, slug, pageNumber, items[], accessories[] }
     * Note: accessories[] appears to be empty in current builds;
     * use getGraphics() instead and join on storyId.
     */
    async getRundown() {
      return request('/api/v1/rundown');
    },

    // ============================================================
    // OVERLAY GRAPHICS
    // ============================================================

    /**
     * GET /api/v1/assets/graphics
     * Returns array of Accessory objects for all overlay graphics in the rundown.
     * Key fields per item:
     *   - id: unique Mosart item ID (use for take/take-out by ID)
     *   - slug: display name (e.g. "LIVE/London")
     *   - storyId: links graphic to a rundown story
     *   - graphicType: out behavior — "STORYEND" | "BACKGROUNDEND" | "MANUAL" | "" (timed)
     *   - handlerName: graphics handler — "DSK" | "WALL_6" | "FLOWICS" etc.
     *   - variant: combined "{graphicType}-{handlerName}"
     *   - status: integer, 0 = idle (on-air values TBD via testing)
     *   - fields[]: array of { name, value, fieldType } with fill-in data
     *     Notable fields: graphics_description, graphics_id, tc_dur,
     *     tc_in, continuecount, thumbnailuri, payloaduri
     *   - in: 0 = manual in, 2 = auto in (with timecode)
     *   - duration, plannedDuration, actualDuration
     */
    async getGraphics() {
      return request('/api/v1/assets/graphics');
    },

    /**
     * GET /api/v1/assets/graphics?onair=true
     * Returns only the graphics that are currently on-air.
     */
    async getOnAirGraphics() {
      return request('/api/v1/assets/graphics?onair=true');
    },

    /**
     * GET /api/v1/build (since v5.4.0) or GET /build (since v5.1.0)
     * Returns { version: string, timestamp: string, ... }
     * Tries the newer /api/v1/build first and falls back to /build on 404.
     */
    async getBuild() {
      try {
        return await request('/api/v1/build');
      } catch (err) {
        if (err && err.statusCode === 404) {
          return await request('/build');
        }
        throw err;
      }
    },

    /**
     * POST /api/v1/assets/graphics/{mosartItemId}/take
     * Take (fire in) a specific overlay graphic by its Mosart item ID.
     * This is the preferred method — IDs are unique across the rundown.
     * @param {string} mosartItemId - The `id` field from getGraphics()
     */
    async takeIn(mosartItemId) {
      return request(`/api/v1/assets/graphics/${encodeURIComponent(mosartItemId)}/take`, {
        method: 'POST',
      });
    },

    /**
     * POST /api/v1/assets/graphics/{mosartItemId}/take-out
     * Take out a specific overlay graphic by its Mosart item ID.
     * @param {string} mosartItemId - The `id` field from getGraphics()
     */
    async takeOut(mosartItemId) {
      return request(`/api/v1/assets/graphics/${encodeURIComponent(mosartItemId)}/take-out`, {
        method: 'POST',
      });
    },

    // ============================================================
    // CONTROL COMMANDS
    // ============================================================

    /**
     * GET /api/v1/command/controlcommand/{command}
     * Send a control command to Mosart.
     * @param {string} command - e.g. 'OVERLAY_GRAPHICS'
     * @param {object} params - query parameters, e.g. { Action: 'TAKE_ALL_OUT', parameter: 'DSK' }
     */
    async controlCommand(command, params = {}) {
      const qs = new URLSearchParams(params).toString();
      const path = `/api/v1/command/controlcommand/${encodeURIComponent(command)}${qs ? '?' + qs : ''}`;
      return request(path);
    },

    /**
     * GET /api/v1/command/template?type={type}&variant={variant}
     * Trigger a template by type and variant (name).
     * @param {string} type - e.g. 'Sound', 'Camera', 'Adlib'
     * @param {string} variant - template name, e.g. 'MUSIC BED'
     */
    async triggerTemplate(type, variant) {
      const qs = new URLSearchParams({ type, variant }).toString();
      return request(`/api/v1/command/template?${qs}`);
    },

    /**
     * POST /api/v1/assets/graphics/take?name={slug}
     * Take (fire in) an overlay graphic by slug name.
     * Warning: slugs may not be unique — prefer takeIn() by ID.
     * @param {string} slug
     */
    async takeInByName(slug) {
      return request(`/api/v1/assets/graphics/take?name=${encodeURIComponent(slug)}`, {
        method: 'POST',
      });
    },

    /**
     * POST /api/v1/assets/graphics/take-out?name={slug}
     * Take out an overlay graphic by slug name.
     * @param {string} slug
     */
    async takeOutByName(slug) {
      return request(`/api/v1/assets/graphics/take-out?name=${encodeURIComponent(slug)}`, {
        method: 'POST',
      });
    },
  };
}

/**
 * Custom error class for Mosart API errors.
 */
export class MosartApiError extends Error {
  constructor(message, statusCode, detail) {
    super(message);
    this.name = 'MosartApiError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

/**
 * Parse a version string like "5.13.0.38555 Beta" into [major, minor, patch].
 * Non-numeric suffixes are ignored. Missing parts default to 0.
 */
export function parseVersion(versionStr) {
  if (!versionStr || typeof versionStr !== 'string') return [0, 0, 0];
  const m = versionStr.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3] || '0', 10)];
}

export function isVersionAtLeast(versionStr, minVersionStr) {
  const a = parseVersion(versionStr);
  const b = parseVersion(minVersionStr);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/**
 * Helper: Extract a named field value from a graphic's fields array.
 * @param {object} graphic - A graphic object from getGraphics()
 * @param {string} fieldName - e.g. 'tc_dur', 'continuecount', 'thumbnailuri'
 * @returns {string|undefined}
 */
export function getField(graphic, fieldName) {
  return graphic.fields?.find(f => f.name === fieldName)?.value;
}

/**
 * Helper: Get the continue count as a number.
 */
export function getContinueCount(graphic) {
  const val = getField(graphic, 'continuecount');
  return val ? parseInt(val, 10) : 0;
}

