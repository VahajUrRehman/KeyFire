// Reactive ambience: typing speed drives the ambience. Faster typing brightens and swells the bed and
// ducks it under the key sounds; it relaxes within about two seconds of stopping. Thunder can follow
// Enter after a burst, or the end of a long one.
import { sk, engine, S, $, bindSlider, setSlider, on } from './core.js';
import { burstCount, setBurstHandler } from './stats.js';

let level = 0;          // 0..1, how hard you are typing right now
let rate = 0;           // smoothed keys per second
let lastKey = 0;
let lastApply = 0;
let lastThunder = 0;

function apply(now) {
  const r = S.reactive;
  engine.setReactive(r.on ? level : 0, r.on ? r.swell : 0, r.on ? r.duck : 0);
  engine.setMusicDuck(level * S.music.duck);       // the music profile's "step aside while typing"
  engine.setMusicFollow(level, S.music.follow);
  lastApply = now;
}

function thunder(now) {
  if (now - lastThunder > 10000 && engine.thunder()) lastThunder = now;
}

/** Called for every key press (the hot path: a few arithmetic ops and at most one apply per 50 ms). */
export function feedReactive(now, code) {
  const r = S.reactive;
  if (!r.on && !S.music.duck && !S.music.follow.on) return;              // nothing is listening to the typing level
  const dt = now - lastKey;
  lastKey = now;
  rate = dt > 1500 ? 1 : rate + (1000 / Math.max(dt, 60) - rate) * 0.4;
  const target = Math.min(1, rate / (9 - 6 * r.sens));        // more sensitive: fewer keys per second to reach full
  if (target > level) level = target;
  if (now - lastApply > 50) apply(now);
  if (r.on && code === 28 && r.thunder && burstCount() >= 8) thunder(now);   // Enter after a burst
}

function renderReactive() {
  const r = S.reactive;
  $('#reactOn').checked = r.on;
  $('#reactThunder').checked = r.thunder;
  setSlider('reactSens', 'reactSensOut', r.sens);
  setSlider('reactSwell', 'reactSwellOut', r.swell);
  setSlider('reactDuck', 'reactDuckOut', r.duck);
  $('#reactBody').classList.toggle('off', !r.on);
  apply(performance.now());          // a scene may have just turned it on or off
}

export function initReactive() {
  const save = () => sk.patch({ reactive: S.reactive });
  $('#reactOn').addEventListener('change', (e) => { S.reactive.on = e.target.checked; save(); renderReactive(); });
  $('#reactThunder').addEventListener('change', (e) => { S.reactive.thunder = e.target.checked; save(); });
  bindSlider('reactSens', 'reactSensOut', (v) => { S.reactive.sens = v; }, save);
  bindSlider('reactSwell', 'reactSwellOut', (v) => { S.reactive.swell = v; apply(performance.now()); }, save);
  bindSlider('reactDuck', 'reactDuckOut', (v) => { S.reactive.duck = v; apply(performance.now()); }, save);

  setBurstHandler((n) => { if (S.reactive.on && S.reactive.thunder && n >= 25) thunder(performance.now()); });

  // relax: exponential decay, about 0.7 s time constant (under 5% after two seconds)
  setInterval(() => {
    if (level > 0.004) {
      level *= Math.exp(-0.1 / 0.7);
      apply(performance.now());
    } else if (level > 0) {
      level = 0;
      apply(performance.now());
    }
    if (!document.hidden) $('#reactMeter').style.width = Math.round(level * 100) + '%';
  }, 100);

  on('render', renderReactive);
}
