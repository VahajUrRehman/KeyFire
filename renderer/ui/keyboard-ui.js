// On-screen keyboard: lights up as you type; click a key to give it its own sound.
import { ROWS, keyLabel } from '../keyboard.js';
import { sk, S, PACKS, $, el, note, on } from './core.js';
import { getPack } from './library.js';

const keyEls = new Map();
let selected = null;

export function light(code) {
  const k = keyEls.get(code);
  if (!k) return;
  k.classList.add('lit');
  clearTimeout(k._t);
  k._t = setTimeout(() => k.classList.remove('lit'), 130);
}

function renderOsk() {
  const box = $('#osk');
  box.replaceChildren();
  keyEls.clear();
  ROWS.forEach((row) => {
    const r = el('div', 'krow');
    row.forEach(([code, label, w]) => {
      const k = el('button', 'key' + (S.overrides[code] ? ' has' : '') + (code === selected ? ' sel' : ''), label);
      k.style.flexGrow = w;
      k.setAttribute('aria-label', `${label} key`);
      k.addEventListener('click', () => { selected = code; renderOsk(); renderOverride(); });
      keyEls.set(code, k);
      r.append(k);
    });
    box.append(r);
  });
}

function renderOverride() {
  $('#ovPanel').hidden = selected == null;
  if (selected == null) return;
  $('#ovTitle').textContent = `${keyLabel(selected)} key`;
  const sel = $('#ovPack');
  sel.replaceChildren(new Option('Current sound', ''), ...PACKS.map((p) => new Option(p.name, p.id)));
  sel.value = S.overrides[selected] || '';
}

export function initKeyboard() {
  $('#ovPack').addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) delete S.overrides[selected];
    else {
      try { await getPack(id); S.overrides[selected] = id; }
      catch (err) { note(`Couldn't load that sound: ${err.message}.`, true); }
    }
    sk.patch({ overrides: S.overrides });
    renderOsk();
    renderOverride();
  });
  on('render', () => { renderOsk(); renderOverride(); });
}
