# Roadmap: beat the field

Reference: other typing-sound apps (keyboard + mouse, keydown/keyup, Ctrl+Alt+M mute, tray,
pack import, online library, web pack editor, themes/backgrounds/logo, ambience, output device picker,
volume above 100%, `--headless`, latency trace).

Legend: [x] done, [ ] to do.

## Already done (ahead of the field)
- [x] Scenes (sound + ambience + room in one click) and saved custom scenes
- [x] Room reverb, per-key stereo panning, pitch/volume variation
- [x] Ambience: synthesized + recorded beds, storm with random thunder, user loops (seamless, auto-levelled)
- [x] Shotgun kit with per-key roles (pump on Enter, boom on Space, shell on Backspace)
- [x] keyboard pack import (folder / zip / many at once), single + multi-file packs
- [x] Tray, F9 pause, start with Windows, single-instance, installer config

## Phase 1: Reliability (trust)  <- start here
- [x] Keep AudioContext alive/awake (no idle wake-up delay; users of other apps report 1-2 s after idle)
- [x] Pre-warm on window show/focus and on first key after long idle
- [x] Health panel: hook running, audio device OK, last-key latency (ms), voices in use
- [x] Auto-restart the key hook if it stops; surface a clear error instead of silent failure
- [x] Voice pool cap (about 32) with oldest-first eviction
- [ ] Ignore software-injected keystrokes (IME, macros): uiohook-napi exposes no injected flag; needs a native hook or fork
- [x] Handle device hot-plug (headphones) without going silent
- Acceptance: key-to-sound under 20 ms in the trace; still instant after 30 min idle.

## Phase 2: Parity with the field
- [x] Mouse sounds (press and release, left/right/middle) with a separate mouse pack slot
- [x] Key-release sounds (V2 packs)
- [x] Output device picker (ambience follows it)
- [x] Volume boost above 100% (limiter already in place)
- [x] Drag-and-drop pack import
- [x] Custom mute hotkey (default F9)
- [ ] Themes, custom logo, background image
- [x] `--headless` / `--soundpack=<id>` command-line mode

## Phase 3: Context awareness (nobody has this)
- [ ] Per-app profiles (active-win): a scene or mute per application
- [ ] Auto-mute while a call is active / microphone in use
- [ ] Pause in fullscreen games
- [ ] Quiet hours / schedule

## Phase 4: Delight
- [ ] Speed-reactive full-auto mode + reload sound after a burst
- [ ] Live typing stats (WPM, streaks, shots fired) and achievements
- [ ] On-screen keyboard that lights up; shell recoil scales with typing speed
- [ ] Layered ambience (rain + fire), per-layer volume
- [ ] Per-key sound overrides

## Phase 5: Ecosystem and ship
- [ ] In-app pack browser with previews and one-click install
- [ ] In-app pack maker (slice one recording into a per-key pack) and export V2 .zip
- [ ] Scene export/import (file or link)
- [ ] AI sound packs (text -> pack)
- [ ] electron-updater auto-update, code signing, crash reporting
- [ ] Unit tests for pack loading, settings migration, id validation
- [ ] Name, logo, landing page  

# Roadmap: a better product than the alternatives (and the rest)

Legend: [x] done, [ ] to do. Phases 1-4 are marked done as reported by the maintainer.

## Competitive picture (what we are measured against)
- **Other typing-sound apps:** keyboard + mouse, key-down/up, packs, online library, pack editor, themes.
- **Keyboard Sounds Pro** (free, MIT): keyboard + mouse profiles, profile builder, pitch/pan/EQ effects,
  per-app rules, per-device volume up to 250%, hotkeys, on-screen shortcut popups for screen sharing.
- **Thockly** (Windows, $4.99): press/release, trackpad/scroll sounds, tone + spatial tuning per profile,
  try-in-browser website, claims about 50 MB RAM and under 2% CPU (markets against Chromium apps).
- **Klack** (Mac, $4.99), **Thock**, **Klakk**, **Haptyk** (loudness follows typing force), **Keystro**
  (on-screen keystrokes for recordings).
- **Ambience apps** (Noisli, myNoise, Endel, Coffitivity): rich sound, but they never react to typing.
- Note: per-app rules and stereo panning are NOT unique to us; don't market them as such.

Our lane: typing sound + ambience + room as one living "scene" that reacts to how you type.

---

## Phases 1-4: done
- [x] Phase 1 Reliability: awake audio engine, health/latency panel, hook auto-restart, voice cap,
      ignore injected keys, device hot-plug
- [x] Phase 2 Parity: mouse sounds, key-release sounds, output device picker, volume boost,
      drag-and-drop import, custom mute hotkey, themes/logo/background, headless mode
- [x] Phase 3 Context: per-app profiles, auto-mute on calls, pause in fullscreen games, quiet hours
- [x] Phase 4 Delight: speed-reactive full-auto + reload, live stats + achievements, on-screen keyboard,
      layered ambience, per-key overrides

---

## Phase 5: Signature features (what nobody combines)
- [x] **Reactive ambience:** typing speed (keys/sec, smoothed) drives ambience parameters per scene:
      rain intensity and filter brightness, wind swell, volume ducking while typing, thunder on Enter or
      after a typing burst. Attack/release smoothing, per-scene enable + sensitivity slider.
- [ ] **Scene scheduler:** auto-switch scenes by time of day, weekday, app (reuse per-app rules), or
      battery/power state. Crossfade between scenes (no hard cut), "manual override until next rule".
- [x] **Focus sessions:** pomodoro-style timer bound to scenes (work scene -> break scene -> long break),
      soft chime, pause/resume, session history feeding the stats screen.
- [ ] **Scene files:** export/import a scene as a single `.scene` file (settings + references to
      bundled assets; user-audio included only if license-safe and size-capped), plus a
      `shotgunkeys://scene?...` deep link (rename with the product name).
- [ ] **Scene transitions:** crossfade sound packs and ambience over 0.5-2 s.
- Acceptance: with reactive ambience on, typing a fast burst audibly swells the ambience within 150 ms
  and relaxes within 2 s of stopping; switching scenes has no click or gap.

## Phase 6: Creator mode (streamers, tutorials, screen recordings)
- [ ] Always-on-top, click-through **keystroke overlay** (transparent window): position, size, fade time,
      themes; modifier-combos-only mode (default) and full mode.
- [ ] **Privacy guards:** default to combos-only, one-key panic hide hotkey, auto-hide overlay while the
      app detects a password-manager/known sensitive app (best effort), clear on-screen "overlay is live" state.
- [ ] Optional cursor highlight and click ripple.
- [ ] Stream-safe audio: option to route typing sounds only to a chosen device (so calls/OBS pick
      what you want); per-device volume for speakers vs headphones.
- Acceptance: overlay adds no perceptible typing lag; never shows plain keystrokes unless the user
  explicitly switched to full mode.

## Phase 7: Sound depth and remaining parity gaps
- [x] **Scroll / trackpad sounds** with their own pack slot and volume (Thockly has this).
- [x] **Per-device volume:** keyboard, mouse, scroll; separate speaker vs headphone profile.
- [x] **Tone/EQ per sound:** low/high shelf + presence (BiquadFilter chain), pitch offset, spatial width.
- [x] **Loudness follows typing intensity:** approximate Haptyk with inter-key interval (faster = softer
      or harder, user-selectable curve).
- [ ] **Pack maker:** drop in one recording, slice it into per-key segments with waveform preview, audition
      per key, export a V2 `.zip`.
- [ ] Import/export of full sound "profiles" (pack + tone + per-key overrides) as a shareable file.
- Acceptance: every tone change is audible instantly (no glitch) and persists per pack.

## Phase 8: Performance and resource diet
Thockly advertises about 50 MB RAM and under 2% CPU; Electron starts heavier, so measure and budget.
- [ ] Baseline: idle and typing RAM/CPU, startup time, key-to-sound latency. Record in `docs/perf.md`.
- [ ] Budgets (initial targets): idle RAM under 150 MB with one pack, CPU under 2% while typing,
      key-to-sound under 20 ms, cold start under 2 s.
- [ ] Lazy-decode packs, evict unused packs from cache, cap decoded audio memory, downsample ambience
      beds where inaudible.
- [ ] Suspend ambience/reverb graph when disabled; no timers running when paused.
- [ ] **Decision gate:** if budgets are missed, prototype a native audio core (Rust or C++ via N-API,
      e.g. miniaudio) and compare. Keep the UI in Electron either way.
- Acceptance: numbers in `docs/perf.md` meet budgets on a mid-range laptop.

## Phase 9: Ecosystem and growth
- [ ] **Web demo:** static site that reuses `renderer/audio.js` so visitors can try scenes and packs in
      the browser before installing (Thockly does this). Our engine is already Web Audio, so this is cheap.
- [ ] **In-app pack browser:** previews, one-click install, license shown per pack; V2-format.
- [ ] **Auto-detect an existing existing install** and offer to import its packs.
- [ ] **Scene gallery:** curated first, community submissions later (moderation + license checks).
- [ ] **AI sound packs:** describe a sound, generate a pack through an audio-generation API; cost cap,
      content filtering, clear licensing of generated output.
- [ ] Localization, including Arabic and right-to-left layout.

## Phase 10: Ship it
- [ ] **Code signing** (EV certificate or Azure Trusted Signing) to remove the SmartScreen warning.
- [ ] **Auto-update** with `electron-updater`; staged rollout + rollback.
- [ ] **Crash reporting and telemetry: opt-in only**, local-first, documented. No key content ever.
- [ ] **Privacy page and in-app panel:** key codes are used only to trigger audio, stay on the device,
      are never stored or sent. Back it with a test that asserts no network calls on keypress.
- [ ] **Pricing decision:** market is free (Keyboard Sounds Pro) and $4.99 one-time (Klack, Thockly).
      Options: free core + paid scene/sound packs, or $4.99 one-time with a 7-day trial.
- [ ] Name, logo, landing page (name shortlist: Roomtone, Brass, Keyscore; check trademark + domains).
- [ ] Microsoft Store (MSIX) listing (optional).
- [ ] Accessibility pass: keyboard-navigable UI, screen-reader labels, high contrast, reduced motion.
- [ ] macOS and Linux ports: macOS needs the Input Monitoring permission flow + notarization;
      Linux/Wayland needs libevdev and `input` group membership (Keyboard Sounds documents this).
- [ ] Test suite + CI: unit tests (pack loader, id validation, settings migration), Playwright UI smoke
      tests with stubbed `window.sk`, GitHub Actions build + signed release.
- [ ] Manual QA matrix on real Windows 10 and 11: global hook, tray, start-with-Windows, installer,
      hot-plug audio, fullscreen games, sleep/resume.

---

## Decisions needed
1. Product name (affects installer id, deep links, domain).
2. Pricing model (free core vs paid vs one-time).
3. Whether to commit to a native audio core if Phase 8 budgets are missed.
4. Audio licensing policy: bundle CC0 only (or properly credited); keyboard pack licenses vary, so do not
   redistribute third-party packs without checking each one.      `````````