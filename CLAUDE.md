# Keyfire: project guide for Claude Code (formerly Shotgun Keys)

Windows Electron app. Every keystroke plays a sound (shotgun kit, Mechvibes-compatible keyboard packs),
with scenes, ambience beds, room reverb and a tray icon. Goal: a better product than Mechvibes / MechvibesDX
(see ROADMAP.md).

## Commands
- `npm install` then `npm start`: run in development
- `npm run dist`: build the Windows NSIS installer into `dist/` (unsigned)
- No test runner yet. UI/audio was verified by loading `renderer/index.html` over a local http server in
  headless Chromium (Playwright) with a stubbed `window.sk`. Keep that approach; it does not need Electron.

## Architecture
- `main.js` (Node): window, tray, single-instance lock, global key hook (`uiohook-napi`), settings JSON,
  pack + ambience + kit file handling, all IPC. The renderer never touches the filesystem.
- `preload.js`: exposes the minimal `window.sk` API via `contextBridge`. Add an IPC handler in `main.js`
  and a wrapper here together.
- `renderer/audio.js`: Web Audio engine. Bus layout: keyBus (volume) -> master, keyBus -> reverb send ->
  convolver -> master, ambBus -> master, master -> compressor(limiter) -> destination. Also the synthesized
  shotgun/pump/shell sounds, procedural ambience, `loopBuffer` (seamless, auto-levelled loops) and thunder.
- `renderer/packs.js`: loaders that return `{ jitter, pick(code), sample() }` for synth, kit, user files
  and Mechvibes packs (single = one audio file sliced by `[startMs, durMs]`, multi = file per key).
- `renderer/scenes.js`: built-in scenes. `renderer/keyboard.js`: on-screen keyboard layout.
- UI is tabbed (Play, Sounds, Atmosphere, Automation, Settings) and modular. `renderer/app.js` only boots.
  `renderer/ui/core.js` holds shared state (`S`, `PACKS`, `app`, ...), DOM helpers and a tiny event bus
  (`on`/`emit`/`render`); `library.js` loads packs/ambience and applies scenes; one module per tab
  (`play`, `sounds`, `atmosphere`, `automation`, `settings`) plus `stats`, `keyboard-ui`, `tabs`, and `input`
  (the key-press hot path). A tab module exports `initX()` and registers its redraw with `on('render', ...)`.
  State objects are filled in place (`Object.assign`, `replace`), never reassigned.
- Styles: `renderer/css/base.css` (tokens), `components.css` (buttons, rows, chips, cards), `layout.css`
  (header, tabs, per-tab layout). Logo: `assets/logo.svg` (also the source of `icon.png` / `icon.ico`).

## Key facts and conventions
- Key codes are uiohook codes, the same code space Mechvibes packs use (Enter 28, Space 57, Backspace 14,
  F9 67). No mapping table needed. Keydown events are de-duplicated in `main.js` (`held` set).
- Pack ids: `synth`, `kit`, `files`, `mech:<folderName>`. Ambience ids: procedural (`wind`, `rain`,
  `night`, `room`), bundled `b:<id>` (from `assets/ambience/index.json`), user `u:<filename>`. Always
  validate ids/filenames with `path.basename` and `inside()` before touching disk.
- Shotgun kit roles come from filename prefix: `blast-*` (letters), `boom-*` (Space), `pump-*` (Enter),
  `shell-*` (Backspace, modifiers). Files in the user `kit` folder override the bundled ones per role.
- Data lives in `%APPDATA%\Keyfire\` (migrated from `%APPDATA%\Shotgun Keys\` on first launch): `settings.json`, `packs\`, `sounds\`, `kit\`, `ambience\`.
  Bundled audio is in `assets\` (read-only, packaged).
- Sounds are pre-decoded `AudioBuffer`s; never decode on a keypress. Keep `onKey` -> `engine.play` free of
  awaits and allocations beyond the few Web Audio nodes per shot.
- Security: `contextIsolation: true`, no `nodeIntegration`, strict CSP in `index.html` (no inline scripts).
- `backgroundThrottling: false` + `autoplayPolicy: 'no-user-gesture-required'` keep audio responsive while the
  window is hidden in the tray. Do not remove them.
- Packaging: `uiohook-napi` is a native module, unpacked from asar (`asarUnpack` in package.json).
- Audio licensing: only bundle CC0 (or properly credited) sounds. Record sources in `assets/*/CREDITS.md`.
- UI style: themeable (Appearance tab). Colors come from CSS variables set at runtime by `renderer/themes.js`
  (`--bg --surface --raise --ink --muted --brass --brass-text --brass-deep --brass-ink`); never hard-code colors in
  CSS, use those variables (`rgb(var(--ink-rgb) / .1)` for ink tints; `--brass-text` when the accent is text).
  Constantia/Georgia serif headings, Segoe UI body, no emoji, no all-caps eyebrow labels, sentence-case copy.

## Status / known gaps
- The full Electron shell (global hook, tray, installer, start-with-Windows) has NOT been run on a real
  Windows machine yet by the assistant that wrote it. Verify these first.
- Bundled "recorded shotgun" files are stylized CC0 game SFX chosen by measurement, not by ear. Replace with
  real recordings when available (see SOUND-SOURCES.md).