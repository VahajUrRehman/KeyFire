// Global key and mouse events from the main process: the hot path from a key press to a sound.
// Keep this free of awaits and allocations beyond the few nodes a shot needs.
import { engine, S, app, loaded, $, sk } from './core.js';
import { fire } from './play.js';
import { track, isFast, intensityMul } from './stats.js';
import { feedReactive } from './reactive.js';
import { light } from './keyboard-ui.js';

// mouse buttons borrow a key's sound: left = Space, right = Backspace, middle = Enter
const MOUSE_KEY = { 1: 57, 2: 14, 3: 28 };
const SCROLL_KEY = 36;   // J: a short, light key in most packs

export function initInput() {
  sk.onKey((code, t) => {
    if (!S.enabled || !app.pack) return;
    const now = performance.now();
    track(now);
    feedReactive(now, code);
    const over = S.overrides[code] && loaded.get(S.overrides[code]);
    const src = over || app.pack;
    // an override on a shotgun pack means "fire the blast here", not that key's role (pump, shell clink)
    let shot = over && over.reload ? over.sample() : src.pick(code);
    if (S.fullAuto && src.reload && isFast(now)) shot = { ...shot, gain: (shot.gain ?? 1) * 0.8, rate: (shot.rate || 1) * 1.1 };
    engine.play(shot, code, intensityMul());
    light(code);
    if (t) app.lastIpcMs = Date.now() - t;
    app.count++;
    $('#count').textContent = app.count.toLocaleString();
    fire();
  });

  sk.onKeyUp((code) => {
    if (!S.enabled || !app.pack || !S.releaseSounds) return;
    const r = app.pack.release?.(code);
    if (r) engine.play(r, code);
  });

  sk.onMouse((button, down) => {
    if (!S.enabled || !app.pack || !S.mouse) return;
    const slot = (S.mouseSlot.pack && loaded.get(S.mouseSlot.pack)) || app.pack;
    const code = MOUSE_KEY[button] || 57;
    const r = down ? slot.pick(code) : slot.release?.(code);
    if (r) engine.play(r, code, 0.85 * S.mouseSlot.volume);
  });

  // scroll wheel and trackpad: a light tick, a touch higher going up and lower going down
  sk.onScroll((dir) => {
    if (!S.enabled || !app.pack || !S.scroll.on) return;
    const slot = (S.scroll.pack && loaded.get(S.scroll.pack)) || app.pack;
    const r = slot.pick(SCROLL_KEY);
    if (r) engine.play({ ...r, rate: (r.rate || 1) * (dir > 0 ? 1.05 : 0.95) }, SCROLL_KEY, 0.7 * S.scroll.volume);
  });

  // keep the audio stream awake
  const wake = () => engine.wake();
  window.addEventListener('focus', wake);
  document.addEventListener('visibilitychange', wake);
}
