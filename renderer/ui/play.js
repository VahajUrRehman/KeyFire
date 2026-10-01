// Play tab: power state, the three mix sliders, scenes, and the recoil animation.
import { sk, engine, S, PACKS, CTX, app, $, el, note, ICON, bindSlider, setSlider, on, emit } from './core.js';
import { allScenes, ambName, applyScene, touch } from './library.js';
import { rememberVolume } from './devices.js';

/** Shell recoil on every shot; it kicks less the faster you type. */
export function fire() {
  const p = $('#shell');
  p.style.setProperty('--kick', Math.max(0.4, 1 - app.curWpm / 180));
  p.classList.remove('fire');
  void p.offsetWidth;
  p.classList.add('fire');
}

function renderPower() {
  const b = $('#power');
  const state = !S.enabled ? 'off' : CTX.reason ? 'muted' : 'on';
  b.setAttribute('aria-pressed', S.enabled);
  b.setAttribute('aria-label', S.enabled ? 'Pause sounds' : 'Resume sounds');
  $('#shell').classList.toggle('off', !S.enabled);
  $('#pill').dataset.state = state;
  $('#pillText').textContent = { on: 'Active', muted: 'Muted', off: 'Paused' }[state];
  $('#status').textContent = !S.enabled ? 'Paused' : CTX.reason ? 'Muted' : 'Firing on every key';

  // say why everything is silent, and offer a way out
  const why = { 'quiet hours': CTX.until ? `Quiet hours, until ${CTX.until}` : 'Quiet hours', 'in a call': 'Your microphone is in use', 'fullscreen app': 'A fullscreen app is open' };
  const name = (r) => why[r] || `${r} is in front`;
  const row = $('#muteRow');
  row.hidden = !(S.enabled && (CTX.reason || CTX.ignored));
  $('#ignoreMute').hidden = !CTX.reason;
  $('#muteText').textContent = CTX.reason ? `${name(CTX.reason)}. Keys, ambience and music are silent.` : CTX.raw ? `Playing anyway: ${name(CTX.raw)}.` : '';
}

function renderSliders() {
  setSlider('vol', 'volOut', S.volume);
  setSlider('dyn', 'dynOut', S.dynamics);
  setSlider('room', 'roomOut', S.reverb.mix);
}

function renderScenes() {
  const list = $('#scenes');
  list.replaceChildren();
  allScenes().forEach((sc) => {
    const card = el('div', 'scene');
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', sc.id === S.scene);
    card.tabIndex = 0;
    card.append(el('div', 'name', sc.name), el('div', 'meta', sc.blurb));
    if (sc.custom) {
      const del = el('button', 'icon');
      del.innerHTML = ICON.trash;
      del.setAttribute('aria-label', 'Delete scene ' + sc.name);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        S.customScenes = S.customScenes.filter((x) => x.id !== sc.id);
        if (S.scene === sc.id) S.scene = null;
        sk.patch({ customScenes: S.customScenes, scene: S.scene });
        renderScenes();
      });
      card.append(del);
    }
    const choose = () => applyScene(sc);
    card.addEventListener('click', choose);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
    });
    list.append(card);
  });
}

export function initPlay() {
  bindSlider('vol', 'volOut',
    (v) => { S.volume = v; engine.setVolume(v); },
    () => { sk.patch({ volume: S.volume }); rememberVolume(); });
  bindSlider('dyn', 'dynOut',
    (v) => { S.dynamics = v; engine.setDynamics(v); },
    () => sk.patch({ dynamics: S.dynamics }));
  bindSlider('room', 'roomOut',
    (v) => { S.reverb.mix = v; engine.setReverb(S.reverb); touch(); },
    () => sk.patch({ reverb: S.reverb }));

  $('#ignoreMute').addEventListener('click', () => sk.ignoreMute());
  $('#power').addEventListener('click', () => {
    S.enabled = !S.enabled;
    renderPower();
    sk.setEnabled(S.enabled);
  });
  sk.onEnabled((v) => { S.enabled = v; renderPower(); });

  // save the current mix as a scene
  const form = $('#sceneForm');
  const toggle = $('#saveSceneBtn');
  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) $('#sceneName').focus();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#sceneName').value.trim();
    if (!name) return;
    const packName = PACKS.find((p) => p.id === S.pack)?.name || 'Shotgun blast';
    const sc = {
      id: 'custom-' + Date.now(), name, custom: true,
      blurb: `${packName}, ${ambName(S.ambience.type)}.`,
      pack: S.pack, ambience: S.ambience.type, ambVol: S.ambience.volume, reverb: { ...S.reverb },
      reactive: { ...S.reactive },
    };
    S.customScenes.push(sc);
    S.scene = sc.id;
    sk.patch({ customScenes: S.customScenes, scene: S.scene });
    $('#sceneName').value = '';
    form.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    renderScenes();
    note(`Saved “${name}”.`);
  });

  on('render', () => { renderPower(); renderSliders(); renderScenes(); $('#count').textContent = app.count.toLocaleString(); });
  on('power', renderPower);
  on('scenes', renderScenes);
}
