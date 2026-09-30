// Automation tab: quiet hours, mute during calls and fullscreen apps, per-app rules.
import { sk, engine, S, CTX, app, $, el, ICON, on, emit } from './core.js';
import { allScenes, applyScene } from './library.js';

const saveContext = () => sk.patch({ context: S.context });
const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]];

// The main process decides when to mute or switch scene; it reports the result here.
function onContext(c) {
  const prev = CTX.scene;
  Object.assign(CTX, c);
  engine.setMuted(!!c.reason);
  emit('power');
  renderProfiles();
  if (c.scene && c.scene !== prev) {
    const sc = allScenes().find((x) => x.id === c.scene);
    if (sc) { if (!prev) app.beforeProfile = S.scene; applyScene(sc); }
  } else if (!c.scene && prev && app.beforeProfile) {
    const sc = allScenes().find((x) => x.id === app.beforeProfile);
    app.beforeProfile = null;
    if (sc) applyScene(sc);
  }
}

function renderProfiles() {
  const c = S.context;
  const actions = [['', 'Mute'], ...allScenes().map((s) => [s.id, 'Scene: ' + s.name])];
  const box = $('#profiles');
  box.replaceChildren();
  c.profiles.forEach((p, i) => {
    const row = el('div', 'prof');
    const label = el('span');
    label.append(el('b', '', p.app), ' → ', actions.find((a) => a[0] === (p.scene || ''))?.[1] || 'Mute');
    const del = el('button', 'icon');
    del.innerHTML = ICON.trash;
    del.setAttribute('aria-label', 'Remove rule for ' + p.app);
    del.addEventListener('click', () => { c.profiles.splice(i, 1); saveContext(); renderProfiles(); });
    row.append(label, del);
    box.append(row);
  });
  const appSel = $('#profApp');
  const keep = appSel.value;
  const apps = [...new Set([CTX.app, ...CTX.recent].filter((a) => a && !c.profiles.some((p) => p.app === a)))];
  appSel.replaceChildren(...(apps.length ? apps : ['Switch to another app first']).map((a) => new Option(a, apps.length ? a : '')));
  if (apps.includes(keep)) appSel.value = keep;
  const act = $('#profAct');
  act.replaceChildren(...actions.map(([v, t]) => new Option(t, v)));
}

function renderQuiet() {
  const q = S.context.quiet;
  const box = $('#quietRules');
  box.classList.toggle('off', !q.on);
  box.replaceChildren();
  q.rules.forEach((r, i) => {
    const row = el('div', 'rule');
    const days = el('div', 'days');
    DAYS.forEach(([label, d]) => {
      const b = el('button', 'day', label);
      b.setAttribute('aria-pressed', r.days.includes(d));
      b.addEventListener('click', () => {
        r.days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d];
        saveContext();
        renderQuiet();
      });
      days.append(b);
    });
    const time = (key, label) => {
      const t = el('input');
      t.type = 'time';
      t.value = r[key];
      t.setAttribute('aria-label', label);
      t.addEventListener('change', () => { r[key] = t.value || r[key]; saveContext(); });
      return t;
    };
    const del = el('button', 'icon');
    del.innerHTML = ICON.trash;
    del.setAttribute('aria-label', 'Remove schedule');
    del.addEventListener('click', () => { q.rules.splice(i, 1); saveContext(); renderQuiet(); });
    row.append(days, time('from', 'Starts'), 'to', time('to', 'Ends'), del);
    box.append(row);
  });
}

function renderContext() {
  const c = S.context;
  $('#quietOn').checked = c.quiet.on;
  renderQuiet();
  $('#muteCall').checked = c.muteInCall;
  $('#muteFull').checked = c.muteFullscreen;
  renderProfiles();
}

export function initAutomation() {
  const c = S.context;
  const change = (id, fn) => $(id).addEventListener('change', (e) => { fn(e.target); saveContext(); });
  change('#quietOn', (t) => { c.quiet.on = t.checked; renderQuiet(); });
  change('#muteCall', (t) => { c.muteInCall = t.checked; });
  change('#muteFull', (t) => { c.muteFullscreen = t.checked; });
  $('#quietAdd').addEventListener('click', () => {
    c.quiet.rules.push({ days: [1, 2, 3, 4, 5], from: '22:00', to: '07:00' });
    saveContext();
    renderQuiet();
  });
  $('#profAdd').addEventListener('click', () => {
    const name = $('#profApp').value;
    if (!name) return;
    c.profiles.push({ app: name, scene: $('#profAct').value || null });
    saveContext();
    renderProfiles();
  });
  sk.onContext(onContext);
  sk.getContext().then(onContext);
  on('render', renderContext);
}
