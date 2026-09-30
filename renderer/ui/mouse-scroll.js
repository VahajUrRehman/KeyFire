// Sounds tab: which sound plays for mouse clicks and for scrolling, and how loud.
import { sk, S, PACKS, $, bindRange, setRange, on } from './core.js';
import { getPack } from './library.js';

const pct = (v) => `${v}%`;

function fill(sel, value) {
  sel.replaceChildren(new Option('Current sound', ''), ...PACKS.map((p) => new Option(p.name, p.id)));
  sel.value = PACKS.some((p) => p.id === value) ? value : '';
}

function renderSlots() {
  $('#mouse').checked = !!S.mouse;
  $('#scrollOn').checked = !!S.scroll.on;
  fill($('#mousePack'), S.mouseSlot.pack);
  fill($('#scrollPack'), S.scroll.pack);
  setRange('mouseVol', 'mouseVolOut', Math.round(S.mouseSlot.volume * 100), pct);
  setRange('scrollVol', 'scrollVolOut', Math.round(S.scroll.volume * 100), pct);
}

/** Load the chosen sounds before the first click needs them. */
export async function preloadSlots() {
  for (const id of [S.mouseSlot.pack, S.scroll.pack]) if (id) { try { await getPack(id); } catch {} }
}

export function initMouseScroll() {
  const choose = (sel, apply, key) => sel.addEventListener('change', async () => {
    if (sel.value) { try { await getPack(sel.value); } catch { sel.value = ''; } }
    apply(sel.value);
    sk.patch({ [key]: S[key] });
  });
  choose($('#mousePack'), (v) => { S.mouseSlot.pack = v; }, 'mouseSlot');
  choose($('#scrollPack'), (v) => { S.scroll.pack = v; }, 'scroll');

  bindRange('mouseVol', 'mouseVolOut', pct, (v) => { S.mouseSlot.volume = v / 100; }, () => sk.patch({ mouseSlot: S.mouseSlot }));
  bindRange('scrollVol', 'scrollVolOut', pct, (v) => { S.scroll.volume = v / 100; }, () => sk.patch({ scroll: S.scroll }));
  $('#scrollOn').addEventListener('change', (e) => { S.scroll.on = e.target.checked; sk.patch({ scroll: S.scroll }); });

  on('render', renderSlots);
}
