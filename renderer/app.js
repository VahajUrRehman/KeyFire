// Bootstrap: load state, bring the audio up, then start each tab's module.
import { sk, engine, S, PACKS, AMBS, TRACKS, loaded, app, $, replace, render } from './ui/core.js';
import { getPack, usePack, setAmb } from './ui/library.js';
import { initTabs } from './ui/tabs.js';
import { initPlay } from './ui/play.js';
import { initStats } from './ui/stats.js';
import { initKeyboard } from './ui/keyboard-ui.js';
import { initSounds } from './ui/sounds.js';
import { initAtmosphere, applyLayers, restoreMusic } from './ui/atmosphere.js';
import { initAutomation } from './ui/automation.js';
import { initSettings } from './ui/settings.js';
import { initAppearance } from './ui/appearance.js';
import { initInput } from './ui/input.js';
import { initReactive } from './ui/reactive.js';
import { initTone } from './ui/tone.js';
import { initMouseScroll, preloadSlots } from './ui/mouse-scroll.js';
import { initFocus } from './ui/focus.js';

(async function init() {
  const st = await sk.getState();
  Object.assign(S, st.settings);
  initAppearance();   // first, so the window is themed before anything else loads
  replace(PACKS, st.packs);
  replace(AMBS, st.ambiences || []);
  if (!PACKS.some((p) => p.id === S.pack)) S.pack = 'synth';

  if (S.outputDevice) engine.setSink(S.outputDevice);
  $('#muteName').textContent = st.muteName;
  engine.setVolume(S.volume);
  engine.setDynamics(S.dynamics);
  await usePack(S.pack);
  engine.setReverb(S.reverb);
  await setAmb(S.ambience.type, S.ambience.volume);
  for (const id of new Set(Object.values(S.overrides))) { try { await getPack(id); } catch {} }
  preloadSlots();
  replace(TRACKS, await sk.listMusic());
  restoreMusic();

  initTabs();
  initPlay();
  initStats();
  initKeyboard();
  initSounds();
  initAtmosphere();
  initAutomation();
  initSettings();
  initInput();
  initReactive();
  initTone();
  initMouseScroll();
  initFocus();
  applyLayers();
  render();

  // pick up files dropped into the library folders while the app was in the background
  window.addEventListener('focus', async () => {
    try {
      const [packs, ambs] = await Promise.all([sk.listPacks(), sk.listAmbience()]);
      const changed = JSON.stringify(packs) !== JSON.stringify(PACKS) || JSON.stringify(ambs) !== JSON.stringify(AMBS);
      replace(PACKS, packs);
      replace(AMBS, ambs);
      loaded.delete('kit');
      if (S.pack === 'kit') await usePack('kit');
      if (Object.values(S.overrides).includes('kit')) await getPack('kit');
      if (changed) render();
    } catch {}
  });
})();
