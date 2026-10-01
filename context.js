// Context awareness: decides whether the sounds should be muted (quiet hours, a call, a fullscreen
// app, a per-app rule) or whether a per-app scene should take over. Runs in the main process.
const path = require('path');
const { execFile } = require('child_process');
const { screen } = require('electron');
const activeWin = require('active-win');

const MIC_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone';

// Windows records when an app last used the microphone; a stop time of 0 means it is using it right now.
const micInUse = () => new Promise((resolve) => {
  execFile('reg', ['query', MIC_KEY, '/s', '/v', 'LastUsedTimeStop'], { windowsHide: true, timeout: 3000 }, (err, out) => {
    resolve(!err && /LastUsedTimeStop\s+REG_QWORD\s+0x0\s*$/m.test(out));
  });
});

// rules: [{ days: [0-6, Sunday = 0], from: 'HH:MM', to: 'HH:MM' }]. A rule that ends before it starts
// (22:00 to 07:00) runs overnight and belongs to the day it starts on. Returns the rule that applies now, or null.
function inQuiet({ on, rules }) {
  if (!on) return null;
  const mins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const n = new Date();
  const now = n.getHours() * 60 + n.getMinutes();
  const today = n.getDay();
  const yesterday = (today + 6) % 7;
  return rules.find(({ days, from, to }) => {
    const a = mins(from);
    const b = mins(to);
    if (a === b) return false;
    if (a < b) return days.includes(today) && now >= a && now < b;
    return (days.includes(today) && now >= a) || (days.includes(yesterday) && now < b);
  }) || null;
}

// Fullscreen = the window covers the whole display, taskbar included. A maximized window stops at the
// taskbar. ponytail: with an auto-hidden taskbar a maximized window looks fullscreen; no cheap fix.
function isFullscreen(bounds) {
  try {
    const r = screen.screenToDipRect(null, bounds);
    const d = screen.getDisplayMatching(r);
    return r.width >= d.bounds.width && r.height >= d.bounds.height;
  } catch { return false; }
}

function createContext(getSettings, onChange) {
  const state = { reason: null, raw: null, ignored: false, until: null, scene: null, app: null, recent: [] };
  let ignoredReason = null;     // a mute the user chose to play through, until that rule stops applying
  let call = false;
  let win = { app: null, fullscreen: false };
  let lastMic = 0;

  function compute() {
    const c = getSettings().context;
    let raw = null;             // why the rules say to mute, whether or not the user overrode it
    let until = null;
    let scene = null;
    const quiet = inQuiet(c.quiet);
    if (quiet) { raw = 'quiet hours'; until = quiet.to; }
    else if (c.muteInCall && call) raw = 'in a call';
    else if (c.muteFullscreen && win.fullscreen) raw = 'fullscreen app';
    else {
      const p = win.app && c.profiles.find((x) => x.app.toLowerCase() === win.app.toLowerCase());
      if (p) { if (p.scene) scene = p.scene; else raw = win.app; }
    }
    if (ignoredReason && raw !== ignoredReason) ignoredReason = null;     // the rule ended or changed: back to normal
    const reason = ignoredReason ? null : raw;
    const next = { reason, raw, ignored: !!ignoredReason, until, scene, app: win.app, recent: state.recent };
    if (JSON.stringify(next) !== JSON.stringify(state)) { Object.assign(state, next); onChange(state); }
  }

  async function tick() {
    try {
      const w = await activeWin();
      if (w?.owner?.path && w.owner.processId !== process.pid) {
        const app = path.basename(w.owner.path);
        win = { app, fullscreen: isFullscreen(w.bounds) };
        if (!state.recent.includes(app)) state.recent = [app, ...state.recent].slice(0, 8);
      }
    } catch {}
    if (getSettings().context.muteInCall && Date.now() - lastMic > 4000) {   // spawns a process, so not every tick
      lastMic = Date.now();
      call = await micInUse();
    } else if (!getSettings().context.muteInCall) call = false;
    compute();
  }

  setInterval(tick, 1500);
  tick();
  // "Play anyway": ignore the current mute until it stops applying
  const ignore = () => { if (state.raw) { ignoredReason = state.raw; compute(); } };
  return { state, refresh: compute, ignore };
}

module.exports = { createContext };
