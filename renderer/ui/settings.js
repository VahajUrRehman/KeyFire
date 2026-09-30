// Settings tab: switches, pause hotkey, output device, library folders, and the health checks.
import { sk, engine, S, app, $, on } from './core.js';
import { initDevices, syncDevice } from './devices.js';

let hook = null;   // key-hook health from the main process

function renderSettings() {
  $('#login').checked = !!S.openAtLogin;
  $('#tray').checked = !!S.trayOnClose;
  $('#release').checked = !!S.releaseSounds;
  $('#mouse').checked = !!S.mouse;
  $('#fullAuto').checked = !!S.fullAuto;
}

function renderHealth() {
  if (document.hidden) return;
  if (hook) {
    $('#hHook').textContent = hook.hook
      ? `Running${hook.restarts ? `, restarted ${hook.restarts} time${hook.restarts === 1 ? '' : 's'}` : ''}`
      : `Stopped: ${hook.error || 'unknown error'}. Retrying every few seconds.`;
  }
  const st = engine.stats();
  $('#hAudio').textContent = `${st.state === 'running' ? 'Running' : st.state}, ${st.voices} voice${st.voices === 1 ? '' : 's'} playing, ${st.outMs.toFixed(0)} ms output delay`;
  if (app.lastIpcMs != null) {
    $('#hLat').textContent = `About ${(app.lastIpcMs + st.outMs).toFixed(0)} ms (${app.lastIpcMs.toFixed(0)} ms to reach the app, ${st.outMs.toFixed(0)} ms output)`;
  }
}

async function loadDevices() {
  const list = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  // a saved device that no longer exists goes back to the system default
  if (S.outputDevice && list.length && !list.some((d) => d.deviceId === S.outputDevice)) {
    S.outputDevice = '';
    sk.patch({ outputDevice: '' });
    engine.setSink('');
  }
  const sel = $('#outDev');
  sel.replaceChildren(new Option('System default', ''));
  list.forEach((d, i) => sel.append(new Option(d.label || `Output ${i + 1}`, d.deviceId)));
  sel.value = S.outputDevice || '';
  if (sel.value !== (S.outputDevice || '')) sel.value = '';
}

export function initSettings() {
  const toggle = (id, key) => $(id).addEventListener('change', (e) => { S[key] = e.target.checked; sk.patch({ [key]: S[key] }); });
  toggle('#login', 'openAtLogin');
  toggle('#tray', 'trayOnClose');
  toggle('#release', 'releaseSounds');
  toggle('#fullAuto', 'fullAuto');
  toggle('#mouse', 'mouse');
  $('#openFolder').addEventListener('click', () => sk.openFolder());
  $('#openKit').addEventListener('click', () => sk.openKit());

  // pause hotkey: the main process grabs the next global key press
  $('#hotkeyBtn').addEventListener('click', async () => {
    $('#hotkeyDesc').textContent = 'Press the key you want. Esc cancels.';
    const r = await sk.captureHotkey();
    if (r) { S.muteKey = r.code; $('#muteName').textContent = r.name; }
    $('#hotkeyDesc').textContent = r ? `Now ${r.name}. Works from any app.` : 'Works from any app.';
  });

  // output device
  const sel = $('#outDev');
  sel.addEventListener('change', async () => { S.outputDevice = sel.value; await engine.setSink(sel.value); sk.patch({ outputDevice: sel.value }); syncDevice(); });
  navigator.mediaDevices?.addEventListener('devicechange', loadDevices);
  loadDevices();
  initDevices();

  // health
  $('#testSound').addEventListener('click', () => { engine.wake(); engine.play({ buffer: engine.synth.blasts[0], gain: 1 }, 30); });
  sk.onHealth((h) => { hook = h; renderHealth(); });
  sk.getHealth().then((h) => { hook = h; renderHealth(); });
  $('#hookRestart').addEventListener('click', async () => { hook = await sk.restartHook(); renderHealth(); });
  setInterval(renderHealth, 1000);

  on('render', renderSettings);
}
