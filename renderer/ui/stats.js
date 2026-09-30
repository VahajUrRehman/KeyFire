// Typing stats: live WPM, bursts, the racked-pump reload and achievements.
import { sk, engine, S, app, $, el, note, on } from './core.js';

const hits = [];           // key times in the last 10 s
let burst = 0;             // keys in the current run (a gap over 1 s ends it)
let lastHit = 0;
let statsSaved = 0;
let lastInterval = 1000;   // ms since the previous key
let onBurstEnd = null;

const ACH = [
  ['first', 'First shot', (s) => s.total >= 1],
  ['k100', '100 shots', (s) => s.total >= 100],
  ['k1000', '1,000 shots', (s) => s.total >= 1000],
  ['k10000', '10,000 shots', (s) => s.total >= 10000],
  ['wpm60', '60 WPM', (s) => s.bestWpm >= 60],
  ['wpm100', '100 WPM', (s) => s.bestWpm >= 100],
  ['run50', '50-key run', (s) => s.bestStreak >= 50],
  ['run200', '200-key run', (s) => s.bestStreak >= 200],
];

/** Called once per key press. */
export function track(now) {
  hits.push(now);
  while (hits[0] < now - 10000) hits.shift();
  lastInterval = now - lastHit;
  if (lastInterval > 1000) burst = 0;
  burst++;
  lastHit = now;
  S.stats.total++;
  if (burst > S.stats.bestStreak) S.stats.bestStreak = burst;
}

export const burstCount = () => burst;
export const setBurstHandler = (fn) => { onBurstEnd = fn; };

/** Loudness that follows typing speed. Returns a gain multiplier (1 or less). */
export function intensityMul() {
  const { mode, amount } = S.intensity;
  if (mode === 'off') return 1;
  const slow = Math.min(1, Math.max(0, (lastInterval - 60) / 340));   // 0 = rapid, 1 = unhurried
  return 1 - amount * 0.6 * (mode === 'softer' ? 1 - slow : slow);
}

/** 8 or more keys inside 1.5 s. */
export const isFast = (now) => hits.length >= 8 && now - hits[hits.length - 8] < 1500;

function wpmNow(now) {
  while (hits.length && hits[0] < now - 10000) hits.shift();
  if (hits.length < 2) return 0;
  return Math.round((hits.length / 5) * (60000 / Math.max(3000, now - hits[0])));
}

function renderAch() {
  const got = S.stats.achievements.length;
  $('#achCount').textContent = `${got} of ${ACH.length} unlocked`;
  $('#ach').replaceChildren(...ACH.map(([id, label]) => el('span', 'badge' + (S.stats.achievements.includes(id) ? ' got' : ''), label)));
}

function tick() {
  const now = performance.now();
  app.curWpm = wpmNow(now);
  if (hits.length >= 10 && app.curWpm > S.stats.bestWpm) S.stats.bestWpm = app.curWpm;
  if (burst >= 15 && now - lastHit > 1200) {                  // burst over: rack the pump
    const n = burst;
    burst = 0;
    onBurstEnd?.(n);
    const r = S.enabled && S.fullAuto && app.pack?.reload?.();
    if (r) engine.play(r, 0);
  }
  let dirty = false;
  for (const [id, label, test] of ACH) {
    if (!S.stats.achievements.includes(id) && test(S.stats)) {
      S.stats.achievements.push(id);
      note(`Achievement: ${label}`);
      renderAch();
      dirty = true;
    }
  }
  if (!document.hidden) {
    $('#wpm').textContent = app.curWpm;
    $('#best').textContent = S.stats.bestWpm;
    $('#total').textContent = S.stats.total.toLocaleString();
  }
  if (dirty || (hits.length && Date.now() - statsSaved > 10000)) { statsSaved = Date.now(); sk.patch({ stats: S.stats }); }
}

export function initStats() {
  on('render', renderAch);
  setInterval(tick, 300);
}
