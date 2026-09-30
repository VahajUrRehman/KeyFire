// Theme data and color math. resolveTheme() turns the saved choices into the CSS variables the UI uses.

export const DARK = {
  midnight: { name: 'Midnight', bg: '#0e1420', surface: '#151d2c', raise: '#1d283b', ink: '#e6ecf7', muted: '#8c99b0' },
  charcoal: { name: 'Charcoal', bg: '#141416', surface: '#1c1c20', raise: '#26262c', ink: '#ececf0', muted: '#9b9ba7' },
  walnut:   { name: 'Walnut',   bg: '#1a130e', surface: '#241a13', raise: '#2e2218', ink: '#efe4d2', muted: '#a8977f' },
  forest:   { name: 'Forest',   bg: '#0f1a14', surface: '#16251c', raise: '#1e3127', ink: '#e3efe6', muted: '#8ba393' },
  plum:     { name: 'Plum',     bg: '#170f1d', surface: '#211629', raise: '#2b1e36', ink: '#f0e6f5', muted: '#a690b3' },
  black:    { name: 'Black',    bg: '#000000', surface: '#0d0d0d', raise: '#181818', ink: '#f2f2f2', muted: '#8e8e8e' },
};

export const LIGHT = {
  snow:  { name: 'Snow',  bg: '#f3f5f8', surface: '#ffffff', raise: '#ffffff', ink: '#1b2029', muted: '#66708a' },
  paper: { name: 'Paper', bg: '#f6f1e7', surface: '#fffdf8', raise: '#ffffff', ink: '#2b2118', muted: '#7a6c5c' },
  sand:  { name: 'Sand',  bg: '#eee4d3', surface: '#f8f2e7', raise: '#ffffff', ink: '#33281c', muted: '#86735e' },
  mint:  { name: 'Mint',  bg: '#ecf4ef', surface: '#fafdfb', raise: '#ffffff', ink: '#1a2a20', muted: '#5f7868' },
  rose:  { name: 'Rose',  bg: '#f8eef1', surface: '#fffafb', raise: '#ffffff', ink: '#2b1c21', muted: '#82666e' },
  mist:  { name: 'Mist',  bg: '#ebf0f7', surface: '#fafcff', raise: '#ffffff', ink: '#1a2233', muted: '#62708a' },
};

export const ACCENTS = [
  { id: 'ember',   name: 'Ember',   color: '#f08a4b' },
  { id: 'brass',   name: 'Brass',   color: '#d2ac60' },
  { id: 'crimson', name: 'Crimson', color: '#e5575f' },
  { id: 'rose',    name: 'Rose',    color: '#ec7aa8' },
  { id: 'violet',  name: 'Violet',  color: '#a98bf0' },
  { id: 'blue',    name: 'Blue',    color: '#5aa2f0' },
  { id: 'teal',    name: 'Teal',    color: '#2fb8a8' },
  { id: 'green',   name: 'Green',   color: '#6fbf73' },
];

export const DEFAULT_THEME = {
  mode: 'auto',               // 'dark' | 'light' | 'auto' (follow Windows)
  dark: 'midnight',           // a DARK id, or 'custom' (uses darkBg)
  light: 'snow',              // a LIGHT id, or 'custom' (uses lightBg)
  accent: '#f08a4b',
  darkBg: '#14181f',
  lightBg: '#f3f5f8',
};

// ------------------------------------------------------------------ color math
const clamp = (n) => Math.min(255, Math.max(0, Math.round(n)));
export const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');

/** t = 0 gives a, t = 1 gives b. */
export const mix = (a, b, t) => {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};

export function luminance(h) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Nudge a color toward `toward` until it reads against `bg`. */
export function ensureContrast(color, bg, toward, min) {
  let c = color;
  for (let i = 0; i < 12 && contrast(c, bg) < min; i++) c = mix(c, toward, 0.12);
  return c;
}

// A palette from one background color, for the custom swatch.
function fromBg(bg) {
  const dark = luminance(bg) < 0.4;
  if (dark) {
    const ink = mix('#ffffff', bg, 0.1);
    return { bg, surface: mix(bg, '#ffffff', 0.05), raise: mix(bg, '#ffffff', 0.1), ink, muted: mix(ink, bg, 0.42) };
  }
  const ink = mix('#000000', bg, 0.12);
  return { bg, surface: mix(bg, '#ffffff', 0.65), raise: '#ffffff', ink, muted: mix(ink, bg, 0.45) };
}

/** Saved choices (plus whether Windows is dark) -> the palette and CSS variables to apply. */
export function resolveTheme(theme, systemDark) {
  const t = { ...DEFAULT_THEME, ...theme };
  const wantDark = t.mode === 'auto' ? systemDark : t.mode === 'dark';
  const id = wantDark ? t.dark : t.light;
  const pool = wantDark ? DARK : LIGHT;
  const custom = wantDark ? t.darkBg : t.lightBg;
  const p = id === 'custom' && isHex(custom) ? fromBg(custom) : pool[id] || Object.values(pool)[0];
  const accent = isHex(t.accent) ? t.accent : DEFAULT_THEME.accent;
  const isDark = luminance(p.bg) < 0.4;

  const vars = {
    '--bg': p.bg,
    '--surface': p.surface,
    '--raise': p.raise,
    '--ink': p.ink,
    '--ink-rgb': rgb(p.ink).join(' '),
    '--muted': p.muted,
    '--brass': accent,                                                   // fills: buttons, selected chips, sliders
    '--brass-text': ensureContrast(accent, p.surface, isDark ? '#ffffff' : '#000000', 3.6),   // accent used as text or icon
    '--brass-deep': mix(accent, p.bg, 0.5),                              // borders
    '--brass-ink': luminance(accent) > 0.36 ? '#1c140c' : '#ffffff',     // text on an accent fill
    '--shadow': isDark ? 'rgba(0,0,0,.45)' : 'rgba(40,30,20,.16)',
  };
  return { vars, scheme: isDark ? 'dark' : 'light', bg: p.bg, ink: p.ink };
}
