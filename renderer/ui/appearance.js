// Appearance tab: light or dark, background palettes, accent colors and a color picker.
import { ACCENTS, DARK, DEFAULT_THEME, LIGHT, isHex, resolveTheme } from '../themes.js';
import { sk, S, $, el, on } from './core.js';

const media = matchMedia('(prefers-color-scheme: dark)');

/** Apply the saved theme to the page and to the window frame. */
export function applyTheme() {
  const r = resolveTheme(S.theme, media.matches);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(r.vars)) root.style.setProperty(k, v);
  root.style.colorScheme = r.scheme;
  sk.themeChrome({ bg: r.bg, ink: r.ink });
}

const save = () => { sk.patch({ theme: S.theme }); applyTheme(); renderAppearance(); };

const MODES = [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Match Windows']];

function swatchRow(box, palettes, key, customKey) {
  box.replaceChildren();
  for (const [id, p] of Object.entries(palettes)) {
    const b = el('button', 'bgSwatch');
    b.style.setProperty('--sw-bg', p.bg);
    b.style.setProperty('--sw-card', p.surface);
    b.style.setProperty('--sw-ink', p.ink);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', S.theme[key] === id);
    b.setAttribute('aria-label', p.name);
    b.append(el('i'), el('span', '', p.name));
    b.addEventListener('click', () => { S.theme[key] = id; save(); });
    box.append(b);
  }
  // custom background: a color picker
  const wrap = el('label', 'bgSwatch custom');
  wrap.setAttribute('aria-checked', S.theme[key] === 'custom');
  wrap.style.setProperty('--sw-bg', S.theme[customKey]);
  wrap.style.setProperty('--sw-card', S.theme[customKey]);
  const input = el('input');
  input.type = 'color';
  input.value = S.theme[customKey];
  input.setAttribute('aria-label', 'Custom background color');
  input.addEventListener('input', () => { S.theme[key] = 'custom'; S.theme[customKey] = input.value; applyTheme(); wrap.style.setProperty('--sw-bg', input.value); });
  input.addEventListener('change', save);
  wrap.append(el('i'), el('span', '', 'Custom'), input);
  box.append(wrap);
}

function renderAppearance() {
  const t = S.theme;

  const modes = $('#modes');
  modes.replaceChildren();
  MODES.forEach(([id, label]) => {
    const b = el('button', 'chip', label);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', t.mode === id);
    b.addEventListener('click', () => { t.mode = id; save(); });
    modes.append(b);
  });

  const acc = $('#accents');
  acc.replaceChildren();
  ACCENTS.forEach((a) => {
    const b = el('button', 'accentSwatch');
    b.style.background = a.color;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', t.accent.toLowerCase() === a.color);
    b.setAttribute('aria-label', a.name);
    b.title = a.name;
    b.addEventListener('click', () => { t.accent = a.color; save(); });
    acc.append(b);
  });
  const custom = el('label', 'accentSwatch custom');
  custom.title = 'Custom color';
  const isCustom = !ACCENTS.some((a) => a.color === t.accent.toLowerCase());
  if (isCustom) custom.style.background = t.accent;       // otherwise it keeps the rainbow from the stylesheet
  custom.setAttribute('aria-checked', isCustom);
  const pick = el('input');
  pick.type = 'color';
  pick.value = t.accent;
  pick.setAttribute('aria-label', 'Custom accent color');
  pick.addEventListener('input', () => { t.accent = pick.value; custom.style.background = pick.value; applyTheme(); });
  pick.addEventListener('change', save);
  custom.append(pick);
  acc.append(custom);
  $('#accentHex').textContent = t.accent.toUpperCase();

  swatchRow($('#darkBgs'), DARK, 'dark', 'darkBg');
  swatchRow($('#lightBgs'), LIGHT, 'light', 'lightBg');
}

export function initAppearance() {
  S.theme = { ...DEFAULT_THEME, ...S.theme };
  if (!isHex(S.theme.accent)) S.theme.accent = DEFAULT_THEME.accent;
  $('#themeReset').addEventListener('click', () => { S.theme = { ...DEFAULT_THEME }; save(); });
  media.addEventListener('change', () => { if (S.theme.mode === 'auto') applyTheme(); });
  applyTheme();
  on('render', renderAppearance);
}
