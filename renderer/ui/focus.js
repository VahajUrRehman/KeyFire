// Focus tab: a pomodoro-style timer. Work, short break and long break can each switch the scene,
// with a soft chime and a notification when a stretch ends. Finished sessions feed the totals.
import { sk, engine, S, app, $, el, on, label } from './core.js';
import { allScenes, applyScene } from './library.js';

const LABEL = { work: 'Focus', short: 'Short break', long: 'Long break' };
const RING = 2 * Math.PI * 88;

// endAt is a wall-clock time, so the timer stays right even if the window is hidden or throttled
const t = { phase: 'work', running: false, endAt: 0, left: 0, cycle: 0 };
const length = (phase) => S.focus[phase] * 60000;

const save = () => sk.patch({ focus: S.focus });

function sceneFor(phase) {
  const sc = allScenes().find((x) => x.id === S.focus[phase + 'Scene']);
  if (!sc) return;
  if (app.beforeFocus === null) app.beforeFocus = S.scene || '';
  applyScene(sc);
}

function begin(phase) {
  t.phase = phase;
  t.left = length(phase);
  t.endAt = Date.now() + t.left;
  t.running = true;
  sceneFor(phase);
  renderFocus();
}

function notify(title, body) {
  if (!S.focus.notify) return;
  try { new Notification(title, { body, silent: true }); } catch {}
}

function nextPhase(done) {
  if (done !== 'work') return 'work';
  return t.cycle % S.focus.every === 0 ? 'long' : 'short';
}

function finish() {
  const done = t.phase;
  if (done === 'work') {
    S.focus.log.push({ t: Date.now(), mins: S.focus.work });
    if (S.focus.log.length > 500) S.focus.log.splice(0, S.focus.log.length - 500);
    t.cycle++;
    save();
  }
  const next = nextPhase(done);
  if (S.focus.chime) engine.chime(done === 'work' ? 'break' : 'work');
  notify(done === 'work' ? 'Time for a break' : 'Back to focus', done === 'work' ? `${LABEL[next]}: ${S.focus[next]} minutes.` : `${S.focus.work} minutes of focus.`);
  if (S.focus.auto) begin(next);
  else { t.phase = next; t.running = false; t.left = length(next); renderFocus(); }
}

function toggle() {
  if (t.running) { t.left = Math.max(0, t.endAt - Date.now()); t.running = false; renderFocus(); return; }
  if (t.left >= length(t.phase)) begin(t.phase);               // fresh start: also applies the scene
  else { t.endAt = Date.now() + t.left; t.running = true; renderFocus(); }
}

function skip() {
  const next = nextPhase(t.phase);
  if (t.phase === 'work') t.cycle++;                            // skipping still moves the round along, but is not logged
  if (t.running) begin(next);
  else { t.phase = next; t.left = length(next); renderFocus(); }
}

function reset() {
  t.running = false;
  t.cycle = 0;
  t.phase = 'work';
  t.left = length('work');
  const back = allScenes().find((x) => x.id === app.beforeFocus);
  app.beforeFocus = null;
  if (back) applyScene(back);
  renderFocus();
}

const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function tick() {
  if (t.running && Date.now() >= t.endAt) { finish(); return; }
  const left = t.running ? Math.max(0, t.endAt - Date.now()) : t.left;
  $('#focusTime').textContent = clock(left);
  const total = length(t.phase) || 1;
  $('#focusRing').style.strokeDashoffset = String(RING * (left / total));          // the ring fills as time passes
  if (t.running && !document.hidden) document.title = `${clock(left)} ${LABEL[t.phase]} · Keyfire`;
  else document.title = 'Keyfire';
}

function renderFocus() {
  $('#focusPhase').textContent = LABEL[t.phase];
  $('#focusRound').textContent = `Session ${(t.cycle % S.focus.every) + 1} of ${S.focus.every}`;
  label($('#focusToggle'), t.running ? 'pause' : 'play', t.running ? 'Pause' : t.left < length(t.phase) ? 'Resume' : 'Start');
  $('#focusToggle').classList.toggle('solid', !t.running);
  $('#focusRing').closest('.ringWrap').dataset.phase = t.phase;

  const day = new Date(); day.setHours(0, 0, 0, 0);
  const today = S.focus.log.filter((x) => x.t >= day.getTime());
  $('#focusToday').textContent = today.length;
  $('#focusMins').textContent = today.reduce((n, x) => n + x.mins, 0);
  $('#focusAll').textContent = S.focus.log.length.toLocaleString();

  for (const k of ['work', 'short', 'long', 'every']) $('#f-' + k).value = S.focus[k];
  for (const p of ['work', 'short', 'long']) {
    const sel = $('#f-' + p + 'Scene');
    sel.replaceChildren(new Option('Keep the current scene', ''), ...allScenes().map((s) => new Option(s.name, s.id)));
    sel.value = allScenes().some((s) => s.id === S.focus[p + 'Scene']) ? S.focus[p + 'Scene'] : '';
  }
  for (const k of ['auto', 'chime', 'notify']) $('#f-' + k).checked = !!S.focus[k];
  tick();
}

export function initFocus() {
  t.left = length('work');
  $('#focusToggle').addEventListener('click', toggle);
  $('#focusSkip').addEventListener('click', skip);
  $('#focusReset').addEventListener('click', reset);

  for (const k of ['work', 'short', 'long', 'every']) {
    $('#f-' + k).addEventListener('change', (e) => {
      const v = Math.min(k === 'every' ? 12 : 180, Math.max(1, Math.round(Number(e.target.value)) || S.focus[k]));
      S.focus[k] = v;
      e.target.value = v;
      if (!t.running && k === t.phase) t.left = length(t.phase);
      save();
      renderFocus();
    });
  }
  for (const p of ['work', 'short', 'long']) {
    $('#f-' + p + 'Scene').addEventListener('change', (e) => { S.focus[p + 'Scene'] = e.target.value; save(); });
  }
  for (const k of ['auto', 'chime', 'notify']) {
    $('#f-' + k).addEventListener('change', (e) => { S.focus[k] = e.target.checked; save(); });
  }

  setInterval(tick, 250);
  on('render', renderFocus);
}
