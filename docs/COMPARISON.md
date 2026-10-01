# Keyfire vs. the alternatives

Where Keyfire is ahead, where it is behind, and what to build next. Competitor details come from their
public listings (links at the bottom), checked October 2026. Prices and feature lists change, so recheck
before you quote them. Keyfire's own claims come from this repo and [perf.md](perf.md).

## The field in one table

Two groups compete with us. **Typing-sound apps** make keys sound like something else. **Ambience and focus
apps** build a soundscape. Nobody does both and lets one react to the other.

| | Keyfire | Keyboard Sounds Pro | Thockly | Klack | Thock | Endel | Noisli | myNoise | Brain.fm |
|---|---|---|---|---|---|---|---|---|---|
| Platform | Windows | Windows, Linux | Windows | Mac | Mac | Mobile, Mac, Windows | Web, apps | Web, apps | Web, apps |
| Price | Free (MIT) | Free, open source | $4.99 once, 7-day trial | $4 once | Free, open source | $6.99/mo or $49.99/yr | Free tier, paid plan | Free, paid extras | $14.99/mo or $99.99/yr |
| Typing sounds | Yes | Yes | Yes | Yes | Yes | No | No | No | No |
| Mouse sounds | Yes | Yes | Yes | No | No | No | No | No | No |
| Scroll / trackpad sounds | Yes | Not listed | Yes | No | No | No | No | No | No |
| Key-release sounds | Yes | Yes | Yes | Yes | Yes | No | No | No | No |
| Built-in profiles | 18 keyboard packs + shotgun kit + synth | 20 | 12 keyboard + 6 mouse | Several | 25+ | n/a | n/a | n/a | n/a |
| Import your own sounds | Yes (packs, loose files) | Yes (WAV, MP3, profile editor) | Not listed | No | No | No | No | No | No |
| Tone controls | Bass, presence, treble, pitch, width | Pitch, pan, EQ | Tone, volume, spatial width | Spatial audio | Volume | No | No | Yes (EQ per generator) | No |
| Room reverb | Yes | No | No | No | No | No | No | No | No |
| Ambience beds | Yes (recorded + synth + layers) | No | No | No | No | Yes (generated) | Yes (16 sounds, mixable) | Yes (hundreds) | Music only |
| Music player | Yes | No | No | No | No | Generated | No | No | Generated |
| Reacts to your typing | Yes | No | No | No | No | No (time, weather, heart rate) | No | No | No |
| Per-app rules | Yes | Yes | Not listed | No | No | No | No | No | No |
| Focus timer | Yes | No | No | No | No | Modes, no timer | Timer | No | Timer |
| Scenes (one-click mood) | Yes | No | No | No | No | Modes | Saved mixes | Saved presets | Modes |

"Not listed" means the source I found does not mention it, not that the app lacks it.

## Where Keyfire is better

1. **The sound reacts to how you type.** Ambience swells and brightens, music gets louder, quicker and
   brighter, thunder follows <kbd>Enter</kbd> after a burst, and fast typing fires tighter shots. No typing-sound
   app does this. The ambience apps react to the clock, weather or heart rate, never to your keys.
2. **One app instead of three.** Typing sounds, ambience and music with room reverb, saved as **scenes**. A
   typing-sound app plus an ambience app plus a music player means three windows and no shared mix.
3. **Context awareness.** Mute during calls, mute in fullscreen apps, quiet hours and a scene per application.
   Keyboard Sounds Pro has per-app rules; the call and fullscreen muting and scheduling are ours.
4. **Focus built in.** A work/break timer that switches scene for each stretch.
5. **Free and open.** The paid Windows rival costs $4.99 and ambience apps charge monthly. We are MIT.
6. **Shotgun kit.** A distinct identity. Per-key roles (boom, pump, shell) are not something the others ship.
7. **Looks and feels like an app you chose.** Twelve themes, eight accents, backgrounds, an on-screen
   keyboard that lights up, live WPM and achievements.
8. **Reliability work.** Awake audio engine, health panel, hook auto-restart, device hot-plug, crash log.
9. **Privacy.** Key codes trigger sounds and nothing else. Local only, no account.

## Where we are still behind

| Gap | Who does it better | Why it matters | Fix |
|---|---|---|---|
| **RAM and CPU** | Thockly: about 50 MB RAM, under 2% CPU, native | We measure 185 to 230 MB idle and 1.8 to 4.3% CPU while typing. People notice a typing app that costs more than their editor. | Try `--disable-gpu`, stop timers while hidden, cheaper reverb, lazy-decode packs (see [perf.md](perf.md)). Fall back to a native audio core only if that fails. |
| **Windows only** | Klack, Thock (Mac); Keyboard Sounds Pro (Linux too) | Mac and Linux users cannot use us. | Port after Windows is solid. macOS needs the Input Monitoring permission flow and notarization. |
| **Not verified on a real machine** | Everyone that has shipped | The tray, global hook, installer and start-with-Windows have not been run on a real Windows machine yet. | Manual QA on Windows 10 and 11 before any release. |
| **No code signing** | Signed apps | SmartScreen warns on first run, which scares people off. | Azure Trusted Signing or an EV certificate. |
| **No auto-update** | Most paid apps | Users stay on old builds. | `electron-updater`. |
| **Key-to-sound delay unproven** | Native apps | Chromium reports about 51 ms of output delay. That may be an estimate, but typing apps live on feel. | Loopback recording to measure the true figure. |
| **No in-app pack browser** | Mobile ambience apps | Finding packs means leaving the app. | Browser with previews, one-click install and per-pack licence. |
| **No pack maker** | Keyboard Sounds Pro (profile editor) | Users cannot build a profile from their own recording. | Slice one recording into per-key segments with a waveform preview. |
| **Small ambience library** | myNoise (hundreds), Noisli (16 mixable) | We bundle four recorded beds plus four synthesized ones. | Add CC0 beds, scene gallery, then community submissions. |
| **No keystroke overlay** | Keystro | Presenters and streamers want keys shown on screen. | Click-through overlay with a panic-hide hotkey and a combos-only default. |
| **No stream-safe routing** | Not solved by anyone listed | Typing sounds leak into calls and recordings. | Route typing sounds to a chosen device only. |
| **No scene sharing** | Noisli (saved mixes) | A scene cannot leave the machine. | `.scene` export and import, then a gallery. |
| **No website or demo** | Thockly (try in browser) | Nobody can try it before installing. | A static page reusing `renderer/audio.js`. |
| **No tests or CI** | n/a | Regressions will ship. | Unit tests for pack loading, id validation and settings migration, plus a UI smoke test. |
| **English only, accessibility not audited** | Mature apps | Narrows the audience. | Localization (including right-to-left) and a screen-reader and high-contrast pass. |

## What to do next

Ordered by what it buys:

1. **Run it on a real Windows machine and fix what breaks.** Nothing else matters if the tray or hook fails.
2. **Cut RAM and CPU.** This is the one number rivals use against Electron apps. Aim for the limits in
   [perf.md](perf.md): idle under 150 MB, typing CPU under 2%.
3. **Measure real latency** with a loopback recording, so we can state a number.
4. **Sign and auto-update.** Removes the SmartScreen warning and keeps users current.
5. **Add a landing page with a browser demo.** The reactive music is the thing to show: seeing the sound follow
   your typing sells it in ten seconds.
6. **Stream-safe routing and a keystroke overlay.** Open ground that nobody on the list covers well.
7. **Pack maker and a pack browser.** Closes the gap with the profile editors.
8. **Mac and Linux ports.**

## How to talk about it

Say these. They are true and the competition cannot match them:
- "The only typing-sound app whose sound follows how you type."
- "Typing sounds, ambience and music as one scene."
- "Free and open source."

Do not say these until they are true:
- "Lightest app" or "lowest latency". Thockly is lighter today, and our delay is not measured.
- "Unique per-app rules" or "unique stereo panning". Others have them.
- "Cross-platform". We are Windows only.

## Sources

- [Keyboard Sounds Pro on AlternativeTo](https://alternativeto.net/software/keyboard-sounds-pro/about)
- [Thockly on Hunted](https://www.hunted.space/product/thockly)
- [Klack on AlternativeTo](https://www.alternativeto.net/software/klack/about/)
- [Thock on AlternativeTo](https://www.alternativeto.net/software/thock/about/)
- [Keyboard Sounds on AlternativeTo](https://www.alternativeto.net/software/keyboard-sounds/)
- [Best Endel alternatives](https://toolfinder.com/alternatives/endel)
- [Brain.fm alternatives](https://lifestack.ai/blog/brain-fm-alternatives)
- [Endel vs Brain.fm](https://toolradar.com/compare/endel-vs-brain-fm)
- [Ambient sound apps for focus](https://goalsandprogress.com/white-noise-focus-apps/)
