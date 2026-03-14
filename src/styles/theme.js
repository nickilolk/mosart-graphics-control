export const darkTheme = {
  '--bg': '#1a1a1e',
  '--surface': '#232328',
  '--surface-hover': '#2a2a30',
  '--border': '#3a3a42',
  '--text-primary': '#e8e8ec',
  '--text-secondary': '#b0b0b8',
  '--text-dim': '#6a6a75',
  '--accent': '#5b9bd5',
  '--handler-bg': 'rgba(255,255,255,0.08)',
  '--handler-text': '#aab0ba',
  '--btn-take-in': '#2e7d32',
  '--btn-take-out': '#c62828',
};

export const lightTheme = {
  '--bg': '#f0f0f2',
  '--surface': '#ffffff',
  '--surface-hover': '#f5f5f8',
  '--border': '#d8d8e0',
  '--text-primary': '#1a1a1e',
  '--text-secondary': '#555560',
  '--text-dim': '#8a8a95',
  '--accent': '#2962ff',
  '--handler-bg': 'rgba(0,0,0,0.06)',
  '--handler-text': '#555560',
  '--btn-take-in': '#2e7d32',
  '--btn-take-out': '#c62828',
};

/**
 * Out behavior display config.
 * Maps graphicType values from the API to labels, colors, and descriptions.
 * Reference: Viz Mosart User Guide 5.13, section on overlay graphics take-out modes.
 */
export const OUT_BEHAVIORS = {
  STORYEND: { label: 'Story', short: 'S', color: '#e8912e', desc: 'Taken out at end of story' },
  BACKGROUNDEND: { label: 'BG End', short: 'B', color: '#5b9bd5', desc: 'Taken out with background element' },
  MANUAL: { label: 'Open', short: 'O', color: '#c45c5c', desc: 'Manual take-out only (open end)' },
  '': { label: 'Dur', short: 'D', color: '#7cba6b', desc: 'Timed duration (auto out)' },
};

export const FIXED_WIDTH = 504;

/**
 * The three badge colors available for handler configuration.
 * These match the existing hardcoded colors in GraphicBadge.
 */
export const HANDLER_COLORS = [
  { id: 'yellow', color: '#f7dd72', label: 'Yellow' },
  { id: 'amber',  color: '#d0b34b', label: 'Amber' },
  { id: 'pink',   color: '#ff8080', label: 'Pink' },
];
