// Shared state, DOM helpers and a tiny event bus. Every UI module imports from here.
import { Engine } from '../audio.js';

export const sk = window.sk;
export const engine = new Engine();

// State objects are created once and filled in place, so every module sees the same reference.
export const S = {};                 // settings (from the main process)
export const PACKS = [];             // available sounds
export const AMBS = [];              // recorded ambience beds (bundled + yours)
export const TRACKS = [];            // your music files
export const CTX = { reason: null, scene: null, app: null, recent: [] };   // what the main process sees: app, call, fullscreen
export const app = { pack: null, curWpm: 0, count: 0, beforeProfile: null, beforeFocus: null, lastIpcMs: null };
export const loaded = new Map();     // pack id -> loaded pack

export const replace = (arr, list) => { arr.splice(0, arr.length, ...list); };

// ---------------------------------------------------------------------- dom
export const $ = (s) => document.querySelector(s);

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

let noteTimer;
export function note(msg, isErr) {
  const n = $('#note');
  n.textContent = msg;
  n.className = isErr ? 'err' : '';
  n.hidden = !msg;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { n.textContent = ''; n.hidden = true; }, 8000);
}

export const paint = (s) => s.style.setProperty('--p', ((s.value - (s.min || 0)) / ((s.max || 100) - (s.min || 0))) * 100 + '%');

export function setSlider(id, out, v) {
  const s = $('#' + id);
  s.value = Math.round(v * 100);
  paint(s);
  $('#' + out).textContent = s.value + '%';
}

/** Sliders with their own units (dB, semitones...): fmt turns the raw value into the label. */
export function setRange(id, out, v, fmt) {
  const s = $('#' + id);
  s.value = v;
  paint(s);
  $('#' + out).textContent = fmt(v);
}

export function bindRange(id, out, fmt, onValue, persist) {
  const s = $('#' + id);
  s.addEventListener('input', () => {
    paint(s);
    const v = Number(s.value);
    $('#' + out).textContent = fmt(v);
    onValue(v);
  });
  s.addEventListener('change', persist);
}

export function bindSlider(id, out, onValue, persist) {
  const s = $('#' + id);
  s.addEventListener('input', () => {
    paint(s);
    $('#' + out).textContent = s.value + '%';
    onValue(s.value / 100);
  });
  s.addEventListener('change', persist);
}

const svg = (d, w = 16) =>
  `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  trash: svg('<path d="M4 7h16M9.5 11v6M14.5 11v6M6 7l1 12.2A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.8L18 7M9 7V4h6v3"/>'),
};

// ---------------------------------------------------------------------- bus
// 'render' redraws everything; 'scenes' and 'power' redraw just those parts.
const subs = {};
export const on = (evt, fn) => { (subs[evt] ||= []).push(fn); };
export const emit = (evt) => (subs[evt] || []).forEach((fn) => fn());
export const render = () => emit('render');
