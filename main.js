const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage, shell, powerMonitor, protocol, net, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const extract = require('extract-zip');
const { createContext } = require('./context');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const F9 = 67; // uiohook key code, same code space Mechvibes packs use
const AUDIO_EXT = ['.ogg', '.wav', '.mp3', '.flac', '.mpeg', '.mpg', '.mp4', '.m4a', '.aac', '.opus'];
const AUDIO_DIALOG = AUDIO_EXT.map((e) => e.slice(1));

// Music streams through this scheme so long tracks are never decoded into memory.
protocol.registerSchemesAsPrivileged([{ scheme: 'skmusic', privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } }]);

let win = null;
let tray = null;
let quitting = false;

const USER = app.getPath('userData');
const PACKS = path.join(USER, 'packs');
const SOUNDS = path.join(USER, 'sounds');
const KIT_USER = path.join(USER, 'kit');
const AMB_USER = path.join(USER, 'ambience');
const MUSIC_USER = path.join(USER, 'music');
const PACKS_BUNDLED = path.join(__dirname, 'assets', 'packs');
const KIT_BUNDLED = path.join(__dirname, 'assets', 'kit');
const AMB_BUNDLED = path.join(__dirname, 'assets', 'ambience');
// Keep a trace of crashes instead of dying silently (see error.log in the data folder).
const logErr = (what, e) => { try { fs.appendFileSync(path.join(USER, 'error.log'), `${new Date().toISOString()} ${what}: ${e?.stack || e}
`); } catch {} };
process.on('uncaughtException', (e) => logErr('main', e));
process.on('unhandledRejection', (e) => logErr('promise', e));
const SETTINGS_FILE = path.join(USER, 'settings.json');
// The app used to be called Shotgun Keys. Bring your library and settings across on first launch.
const OLD_DATA = path.join(app.getPath('appData'), 'Shotgun Keys');
if (!fs.existsSync(path.join(USER, 'settings.json')) && fs.existsSync(path.join(OLD_DATA, 'settings.json'))) {
  for (const n of ['settings.json', 'packs', 'sounds', 'kit', 'ambience', 'music']) {
    try { fs.cpSync(path.join(OLD_DATA, n), path.join(USER, n), { recursive: true }); } catch {}
  }
}
for (const d of [PACKS, SOUNDS, KIT_USER, AMB_USER, MUSIC_USER]) fs.mkdirSync(d, { recursive: true });

// ------------------------------------------------------------------ settings
const DEFAULTS = {
  enabled: true,
  volume: 0.8,
  dynamics: 0.25,
  pack: 'kit',
  scene: 'range',
  reverb: { mix: 0.28, seconds: 1.6 },
  ambience: { type: 'wind', volume: 0.35 },
  music: { volume: 0.5, track: null, playing: false, shuffle: false, profile: 'flat', bass: 0, treble: 0, soft: 0, space: 0, level: 1, duck: 0 },
  customScenes: [],
  releaseSounds: true,
  fullAuto: true,
  overrides: {},   // key code -> pack id
  layers: [],      // extra ambience layers: [{ type, volume }]
  stats: { total: 0, bestWpm: 0, bestStreak: 0, achievements: [] },
  reactive: { on: false, sens: 0.6, swell: 0.6, duck: 0.25, thunder: true },   // ambience that follows typing speed
  focus: { work: 25, short: 5, long: 15, every: 4, workScene: '', shortScene: '', longScene: '', auto: true, chime: true, notify: true, log: [] },
  tone: {},                                     // pack id -> { bass, presence, treble, pitch, width }
  intensity: { mode: 'off', amount: 0.5 },      // loudness follows typing speed
  mouseSlot: { pack: '', volume: 1 },
  scroll: { on: false, pack: '', volume: 0.5 },
  perDevice: false,                             // remember the volume for each output device
  deviceVolumes: {},
  theme: { mode: 'auto', dark: 'midnight', light: 'snow', accent: '#f08a4b', darkBg: '#14181f', lightBg: '#f3f5f8' },
  chrome: { bg: '#0e1420', ink: '#e6ecf7' },   // window frame colors, kept in step with the theme
  mouse: false,
  muteKey: F9,
  outputDevice: '',
  context: { quiet: { on: false, rules: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '22:00', to: '07:00' }] }, muteInCall: false, muteFullscreen: false, profiles: [] },
  openAtLogin: false,
  trayOnClose: true,
};

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    const q = saved.context?.quiet;                       // older builds stored one from/to pair
    if (q && !Array.isArray(q.rules)) q.rules = [{ days: [0, 1, 2, 3, 4, 5, 6], from: q.from || '22:00', to: q.to || '07:00' }];
    const out = { ...structuredClone(DEFAULTS), ...saved };
    for (const [k, v] of Object.entries(DEFAULTS)) {       // fill in fields added since the file was saved
      if (v && typeof v === 'object' && !Array.isArray(v) && saved[k] && typeof saved[k] === 'object') out[k] = { ...v, ...saved[k] };
    }
    return out;
  } catch {
    return structuredClone(DEFAULTS);
  }
}
let settings = loadSettings();
const saveSettings = () => {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch {}
};

function applyLogin() {
  app.setLoginItemSettings({ openAtLogin: !!settings.openAtLogin, args: ['--hidden'] });
}

// --------------------------------------------------------------------- packs
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const isAudio = (f) => AUDIO_EXT.includes(path.extname(f).toLowerCase());
const slug = (s) => s.replace(/[^\w.-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '') || 'pack';
const inside = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
};

function soundFiles() {
  return fs.readdirSync(SOUNDS).filter(isAudio).sort();
}

// Recorded shotgun kit: files are matched to a role by name (blast-*, boom-*, pump-*, shell-*).
// Files you drop in the user kit folder replace the bundled ones for that role.
const KIT_ROLES = ['blast', 'boom', 'pump', 'shell'];
const listAudio = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(isAudio).sort() : []);
function kitFiles() {
  const roles = {};
  for (const r of KIT_ROLES) {
    const match = (f) => f.toLowerCase().startsWith(r);
    const user = listAudio(KIT_USER).filter(match).map((f) => path.join(KIT_USER, f));
    const bundled = listAudio(KIT_BUNDLED).filter(match).map((f) => path.join(KIT_BUNDLED, f));
    roles[r] = user.length ? user : bundled;
  }
  return roles;
}
const kitHasUserFiles = () => KIT_ROLES.some((r) => listAudio(KIT_USER).some((f) => f.toLowerCase().startsWith(r)));

// Ambience: bundled beds are described by assets/ambience/index.json; your own live in AMB_USER.
function bundledAmbience() {
  try { return JSON.parse(fs.readFileSync(path.join(AMB_BUNDLED, 'index.json'), 'utf8')); } catch { return []; }
}
function ambienceList() {
  const out = bundledAmbience().map((a) => ({ id: 'b:' + a.id, name: a.name, blurb: a.blurb, removable: false }));
  for (const f of listAudio(AMB_USER)) {
    out.push({ id: 'u:' + f, name: path.parse(f).name.replace(/[-_]+/g, ' '), blurb: 'Your file', removable: true });
  }
  return out;
}
function readAmbience(id) {
  if (id.startsWith('b:')) {
    const a = bundledAmbience().find((x) => 'b:' + x.id === id);
    if (!a) throw new Error('unknown ambience');
    return {
      data: fs.readFileSync(path.join(AMB_BUNDLED, a.file)),
      thunder: a.thunder ? fs.readFileSync(path.join(AMB_BUNDLED, a.thunder)) : null,
    };
  }
  if (id.startsWith('u:')) {
    const name = id.slice(2);
    if (!name || name !== path.basename(name)) throw new Error('bad ambience id');
    return { data: fs.readFileSync(path.join(AMB_USER, name)), thunder: null };
  }
  throw new Error('unknown ambience');
}

function listPacks() {
  const out = [
    { id: 'synth', name: 'Shotgun blast', meta: 'Built in, synthesized', removable: false },
    {
      id: 'kit', name: 'Shotgun, recorded', removable: false,
      meta: kitHasUserFiles() ? 'Open recordings plus your own kit files' : 'Open-licensed recordings (CC0)',
    },
  ];
  const files = soundFiles();
  if (files.length) {
    out.push({
      id: 'files', name: 'Your sounds', removable: true,
      meta: `${files.length} file${files.length === 1 ? '' : 's'} you added`,
    });
  }
  const seen = new Set();
  for (const root of [PACKS, PACKS_BUNDLED]) {
    if (!fs.existsSync(root)) continue;
    const folders = fs.readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !seen.has(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    for (const f of folders) {
      const cfg = path.join(root, f, 'config.json');
      if (!fs.existsSync(cfg)) continue;
      try {
        const c = readJson(cfg);
        seen.add(f);
        out.push({ id: 'mech:' + f, name: String(c.name || f), meta: root === PACKS ? 'Keyboard pack' : 'Keyboard pack, included', removable: root === PACKS });
      } catch {}
    }
  }
  return out;
}

function packFolder(id) {
  const name = id.slice(5);
  if (!name || name !== path.basename(name)) throw new Error('bad pack id');
  const user = path.join(PACKS, name);
  return fs.existsSync(user) ? user : path.join(PACKS_BUNDLED, name);
}

// "GENERIC_R{0-4}.mp3" -> GENERIC_R0.mp3 ... GENERIC_R4.mp3 (Mechvibes v2 fallback sounds)
function expandSound(pattern) {
  const m = /\{(\d+)-(\d+)\}/.exec(pattern);
  if (!m) return [pattern];
  const out = [];
  for (let i = Number(m[1]); i <= Number(m[2]) && out.length < 64; i++) out.push(pattern.replace(m[0], i));
  return out;
}

function readPack(id) {
  if (id === 'kit') {
    const roles = {};
    for (const [r, files] of Object.entries(kitFiles())) {
      roles[r] = files.map((f) => ({ name: path.basename(f), data: fs.readFileSync(f) }));
    }
    return { type: 'kit', roles };
  }
  if (id === 'files') {
    return {
      type: 'files',
      sounds: soundFiles().map((f) => ({ name: f, data: fs.readFileSync(path.join(SOUNDS, f)) })),
    };
  }
  if (id.startsWith('mech:')) {
    const folder = packFolder(id);
    const config = readJson(path.join(folder, 'config.json'));
    const names = new Set();
    let generic = [];
    let genericUp = [];
    if (typeof config.sound === 'string') {
      generic = expandSound(config.sound);
      generic.forEach((n) => names.add(n));
    }
    if (typeof config.soundup === 'string') {
      genericUp = expandSound(config.soundup);
      genericUp.forEach((n) => names.add(n));
    }
    for (const v of Object.values(config.defines || {})) {
      if (typeof v === 'string') names.add(v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const x of Object.values(v)) if (typeof x === 'string') names.add(x);
      }
    }
    const files = {};
    for (const n of names) {
      const full = path.resolve(folder, n);
      if (inside(folder, full) && fs.existsSync(full)) files[n] = fs.readFileSync(full);
    }
    return { type: 'mech', config, files, generic: generic.filter((n) => files[n]), genericUp: genericUp.filter((n) => files[n]) };
  }
  throw new Error('unknown pack');
}

function configRoots(dir) {
  const roots = [];
  (function walk(d) {
    if (fs.existsSync(path.join(d, 'config.json'))) { roots.push(d); return; }
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
    }
  })(dir);
  return roots;
}

function installPack(src, hint) {
  const base = slug(hint);
  let dest = path.join(PACKS, base);
  for (let n = 2; fs.existsSync(dest); n++) dest = path.join(PACKS, `${base}-${n}`);
  fs.cpSync(src, dest, { recursive: true });
  try {
    const c = readJson(path.join(dest, 'config.json'));
    if (!c.defines || !Object.keys(c.defines).length) throw new Error('it has no key definitions');
    if (typeof c.sound === 'string' && !fs.existsSync(path.join(dest, c.sound))) {
      throw new Error(`the sound file "${c.sound}" is missing`);
    }
  } catch (e) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw new Error(`Couldn't read the pack "${hint}": ${e.message}.`);
  }
  return 'mech:' + path.basename(dest);
}

async function addPack(kind) {
  const filters = {
    sounds: [{ name: 'Audio files', extensions: AUDIO_DIALOG }],
    zip: [{ name: 'Keyboard packs', extensions: ['zip'] }],
  };
  const props = { sounds: ['openFile', 'multiSelections'], zip: ['openFile'], folder: ['openDirectory'] }[kind];
  const res = await dialog.showOpenDialog(win, { properties: props, filters: filters[kind] });
  if (res.canceled || !res.filePaths.length) return { ok: true };

  if (kind === 'sounds') {
    let added = 0;
    for (const p of res.filePaths) {
      if (!isAudio(p)) continue;
      const { name, ext } = path.parse(p);
      let dest = path.join(SOUNDS, name + ext);
      for (let n = 2; fs.existsSync(dest); n++) dest = path.join(SOUNDS, `${name}-${n}${ext}`);
      fs.copyFileSync(p, dest);
      added++;
    }
    return added
      ? { ok: true, select: 'files', note: `Added ${added} sound${added === 1 ? '' : 's'}.` }
      : { ok: true };
  }

  let roots, hint, tmp;
  if (kind === 'zip') {
    tmp = fs.mkdtempSync(path.join(PACKS, '_tmp'));
    try {
      await extract(res.filePaths[0], { dir: tmp });
      roots = configRoots(tmp);
      if (!roots.length) return { ok: false, note: "That zip doesn't contain a config.json." };
      hint = path.parse(res.filePaths[0]).name;
      const ids = roots.map((r) => installPack(r, roots.length === 1 ? hint : path.basename(r)));
      return { ok: true, select: ids[0], note: `Added ${ids.length} pack${ids.length === 1 ? '' : 's'}.` };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  roots = configRoots(res.filePaths[0]);
  if (!roots.length) return { ok: false, note: "That folder doesn't contain a config.json." };
  const ids = roots.map((r) => installPack(r, path.basename(r)));
  return { ok: true, select: ids[0], note: `Added ${ids.length} pack${ids.length === 1 ? '' : 's'}.` };
}

async function importDropped(paths) {
  const ids = [];
  for (const p of paths) {
    if (fs.statSync(p).isDirectory()) {
      for (const r of configRoots(p)) ids.push(installPack(r, path.basename(r)));
    } else if (p.toLowerCase().endsWith('.zip')) {
      const tmp = fs.mkdtempSync(path.join(PACKS, '_tmp'));
      try {
        await extract(p, { dir: tmp });
        const roots = configRoots(tmp);
        for (const r of roots) ids.push(installPack(r, roots.length === 1 ? path.parse(p).name : path.basename(r)));
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
  }
  return ids.length
    ? { ok: true, select: ids[0], note: `Added ${ids.length} pack${ids.length === 1 ? '' : 's'}.` }
    : { ok: false, note: 'Drop a keyboard pack folder or .zip (it needs a config.json).' };
}

async function addAudio(dir) {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio files', extensions: AUDIO_DIALOG }],
  });
  if (res.canceled || !res.filePaths.length) return { added: 0 };
  let first = null;
  let added = 0;
  for (const p of res.filePaths) {
    if (!isAudio(p)) continue;
    const { name, ext } = path.parse(p);
    let dest = path.join(dir, name + ext);
    for (let n = 2; fs.existsSync(dest); n++) dest = path.join(dir, `${name}-${n}${ext}`);
    fs.copyFileSync(p, dest);
    first = first || path.basename(dest);
    added++;
  }
  return { added, first };
}

async function addAmbience() {
  const { added, first } = await addAudio(AMB_USER);
  return added
    ? { ok: true, select: 'u:' + first, note: `Added ${added} ambience file${added === 1 ? '' : 's'}.` }
    : { ok: true };
}

async function addMusic() {
  const { added } = await addAudio(MUSIC_USER);
  return added ? { ok: true, note: `Added ${added} track${added === 1 ? '' : 's'}.` } : { ok: true };
}

// ------------------------------------------------------------------- window
const headless = process.argv.includes('--headless');   // no window, no tray icon
const startHidden = headless || process.argv.includes('--hidden');
const soundpack = process.argv.find((a) => a.startsWith('--soundpack='));
if (soundpack) settings.pack = soundpack.slice('--soundpack='.length);   // e.g. --soundpack=mech:cherrymx-blue-abs

// The multi-size .ico gives Windows a sharp icon for the taskbar, Alt+Tab and the tray.
const APP_ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

function createWindow() {
  // Fit the window inside the usable screen (display scaling can make a fixed 1000x760 taller than the screen).
  const work = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1000, work.width - 40);
  const height = Math.min(760, work.height - 40);
  win = new BrowserWindow({
    width, height, minWidth: Math.min(820, width), minHeight: Math.min(600, height),
    show: false,
    title: 'Keyfire',
    backgroundColor: settings.chrome.bg,
    autoHideMenuBar: true,
    icon: APP_ICON,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: settings.chrome.bg, symbolColor: settings.chrome.ink, height: 56 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,            // keep audio snappy while hidden in the tray
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.webContents.on('render-process-gone', (_e, d) => { logErr('renderer gone', JSON.stringify(d)); win.reload(); });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.on('close', (e) => {
    if (!quitting && settings.trayOnClose) { e.preventDefault(); win.hide(); }
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function buildTray() {
  tray = new Tray(APP_ICON);
  tray.setToolTip('Keyfire');
  tray.on('click', showWindow);
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Keyfire', click: showWindow },
    { label: 'Firing on every key', type: 'checkbox', checked: settings.enabled, click: () => setEnabled(!settings.enabled) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
}

function setEnabled(v) {
  settings.enabled = !!v;
  saveSettings();
  refreshTray();
  toUI('enabled', settings.enabled);
}

// ---------------------------------------------------------------------- IPC
function mergePatch(patch) {
  for (const [k, v] of Object.entries(patch)) {
    if ((k === 'reverb' || k === 'ambience' || k === 'music' || k === 'context' || k === 'theme' || k === 'reactive' || k === 'focus' || k === 'intensity' || k === 'mouseSlot' || k === 'scroll') && v && typeof v === 'object') settings[k] = { ...settings[k], ...v };
    else settings[k] = v;
  }
  if ('openAtLogin' in patch) applyLogin();
  if ('context' in patch) ctx?.refresh();
  saveSettings();
}

ipcMain.handle('state:get', () => ({ settings, packs: listPacks(), ambiences: ambienceList(), muteName: keyName(settings.muteKey) }));
ipcMain.handle('hotkey:capture', () => new Promise((resolve) => {
  if (capture) capture(UiohookKey.Escape);      // cancel an earlier, unanswered capture
  capture = (code) => {
    if (code === UiohookKey.Escape) return resolve(null);
    settings.muteKey = code;
    saveSettings();
    resolve({ code, name: keyName(code) });
  };
}));
ipcMain.handle('pack:drop', async (_e, paths) => {
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string')) return { ok: false, packs: listPacks() };
  try { return { ...(await importDropped(paths)), packs: listPacks() }; }
  catch (e) { return { ok: false, note: e.message, packs: listPacks() }; }
});
ipcMain.handle('settings:patch', (_e, patch) => { mergePatch(patch); return true; });
ipcMain.handle('enabled:set', (_e, v) => { setEnabled(v); return true; });
ipcMain.handle('packs:list', () => listPacks());
ipcMain.handle('pack:read', (_e, id) => readPack(id));
ipcMain.handle('pack:add', async (_e, kind) => {
  try { return { ...(await addPack(kind)), packs: listPacks() }; }
  catch (e) { return { ok: false, note: e.message, packs: listPacks() }; }
});
ipcMain.handle('pack:remove', (_e, id) => {
  try {
    if (id === 'files') for (const f of soundFiles()) fs.rmSync(path.join(SOUNDS, f));
    else if (id.startsWith('mech:')) fs.rmSync(path.join(PACKS, path.basename(packFolder(id))), { recursive: true, force: true });
    return { ok: true, packs: listPacks() };
  } catch (e) {
    return { ok: false, note: `Couldn't remove it: ${e.message}`, packs: listPacks() };
  }
});
ipcMain.handle('music:list', () => listAudio(MUSIC_USER));
ipcMain.handle('music:add', async () => {
  try { return { ...(await addMusic()), tracks: listAudio(MUSIC_USER) }; }
  catch (e) { return { ok: false, note: e.message, tracks: listAudio(MUSIC_USER) }; }
});
ipcMain.handle('music:remove', (_e, name) => {
  try {
    if (name && name === path.basename(name)) fs.rmSync(path.join(MUSIC_USER, name), { force: true });
    return { ok: true, tracks: listAudio(MUSIC_USER) };
  } catch (e) {
    return { ok: false, note: `Couldn't remove it: ${e.message}`, tracks: listAudio(MUSIC_USER) };
  }
});
ipcMain.handle('context:get', () => ctx.state);
ipcMain.handle('context:ignore', () => { ctx?.ignore(); return true; });
ipcMain.handle('theme:chrome', (_e, c) => {
  const ok = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
  if (!c || !ok(c.bg) || !ok(c.ink)) return false;
  settings.chrome = { bg: c.bg, ink: c.ink };
  saveSettings();
  try { win?.setBackgroundColor(c.bg); win?.setTitleBarOverlay({ color: c.bg, symbolColor: c.ink, height: 56 }); } catch {}
  return true;
});
ipcMain.handle('health:get', () => health);
ipcMain.handle('hook:restart', () => { restartHook(); return health; });
ipcMain.handle('open:folder', () => shell.openPath(USER));
ipcMain.handle('open:kit', () => shell.openPath(KIT_USER));
ipcMain.handle('amb:list', () => ambienceList());
ipcMain.handle('amb:read', (_e, id) => readAmbience(id));
ipcMain.handle('amb:add', async () => {
  try { return { ...(await addAmbience()), ambiences: ambienceList() }; }
  catch (e) { return { ok: false, note: e.message, ambiences: ambienceList() }; }
});
ipcMain.handle('amb:remove', (_e, id) => {
  try {
    if (id.startsWith('u:')) {
      const name = id.slice(2);
      if (name && name === path.basename(name)) fs.rmSync(path.join(AMB_USER, name), { force: true });
    }
    return { ok: true, ambiences: ambienceList() };
  } catch (e) {
    return { ok: false, note: `Couldn't remove it: ${e.message}`, ambiences: ambienceList() };
  }
});

// ----------------------------------------------------------- global key hook
const held = new Set();
let ctx = null; // context awareness (quiet hours, calls, fullscreen, per-app rules)
const live = () => settings.enabled && !ctx?.state.reason;
let capture = null; // set while the user is choosing a new pause hotkey
const keyName = (code) => Object.entries(UiohookKey).find(([, v]) => v === code)?.[0] || `Key ${code}`;
const health = { hook: false, error: null, restarts: 0 };
let hookBound = false;
let hookRetry = null;
const sendHealth = () => { try { toUI('health', health); } catch {} };

// uiohook-napi calls these handlers from native code. An exception thrown in one aborts the whole process
// ("FATAL ERROR: tsfn_to_js_proxy napi_call_function"), so every handler is wrapped, and messages to the
// window go through toUI, which skips a page that is reloading or gone.
const toUI = (...args) => {
  const wc = win && !win.isDestroyed() ? win.webContents : null;
  if (wc && !wc.isDestroyed()) wc.send(...args);
};
const safe = (fn) => (e) => { try { fn(e); } catch (err) { logErr('key hook', err); } };

function startHook() {
  if (!hookBound) {
    hookBound = true;
    uIOhook.on('keydown', safe((e) => {
      if (held.has(e.keycode)) return;          // ignore OS key-repeat
      held.add(e.keycode);
      if (capture) { const c = capture; capture = null; return c(e.keycode); }
      if (e.keycode === settings.muteKey) return setEnabled(!settings.enabled);
      if (live()) toUI('key', e.keycode, Date.now());
    }));
    uIOhook.on('keyup', safe((e) => {
      held.delete(e.keycode);
      if (live() && settings.releaseSounds && e.keycode !== settings.muteKey) toUI('keyup', e.keycode);
    }));
    // button: 1 left, 2 right, 3 middle
    uIOhook.on('mousedown', safe((e) => { if (live() && settings.mouse) toUI('mouse', e.button, true); }));
    let lastWheel = 0;
    uIOhook.on('wheel', safe((e) => {           // throttled: a free-spinning wheel fires far faster than a person can hear
      const t = Date.now();
      if (!live() || !settings.scroll.on || t - lastWheel < 45) return;
      lastWheel = t;
      toUI('scroll', e.rotation > 0 ? 1 : -1);
    }));
    uIOhook.on('mouseup', safe((e) => { if (live() && settings.mouse && settings.releaseSounds) toUI('mouse', e.button, false); }));
  }
  clearTimeout(hookRetry);
  try {
    uIOhook.start();
    health.hook = true; health.error = null;
  } catch (e) {
    health.hook = false; health.error = e.message || String(e);
    hookRetry = setTimeout(startHook, 5000);  // keep trying; the panel shows why it's down
  }
  sendHealth();
}

// The OS can drop low-level hooks after sleep or a lock screen, silently. Restart on wake.
function restartHook() {
  try { uIOhook.stop(); } catch {}
  held.clear();
  health.restarts++;
  startHook();
}

// ---------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  // Must match build.appId: Windows uses it to group the taskbar button, pick its icon, and name notifications.
  app.setAppUserModelId('com.vahaj.keyfire');
  app.whenReady().then(() => {
    protocol.handle('skmusic', async (req) => {
      const name = decodeURIComponent(new URL(req.url).pathname.slice(1));
      const file = path.join(MUSIC_USER, name);
      if (!name || name !== path.basename(name) || !isAudio(name) || !fs.existsSync(file)) return new Response('', { status: 404 });
      const r = await net.fetch(pathToFileURL(file).href, { headers: req.headers }); // keeps Range requests working
      const headers = new Headers(r.headers);
      headers.set('access-control-allow-origin', '*');
      return new Response(r.body, { status: r.status, headers });
    });
    Menu.setApplicationMenu(null);
    createWindow();
    if (!headless) buildTray();
    ctx = createContext(() => settings, (s) => toUI('context', s));
    startHook();
    applyLogin();
    for (const ev of ['resume', 'unlock-screen']) powerMonitor.on(ev, () => setTimeout(restartHook, 1500));
  });
  app.on('before-quit', () => { quitting = true; try { uIOhook.stop(); } catch {} });
  app.on('window-all-closed', () => { /* stay alive in the tray */ });
}
