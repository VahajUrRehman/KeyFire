# Performance

How Keyfire measures against the Phase 8 limits in `ROADMAP.md`, and how to check it yourself.
Windows only for now. Both tools need PowerShell, which every Windows 10 and 11 install has.

## Check it yourself

| Command | What it does |
|---|---|
| `npm run monitor` | Watches a Keyfire that is already running (installed, or `npm start`). Prints RAM and CPU every few seconds. Press Ctrl+C for a summary with pass/over. Use the app normally while it runs. |
| `npm run perf` | Launches Keyfire with a throw-away profile, types into it, and prints a table: start time, idle RAM, typing CPU, key-to-sound. About 5 minutes. Don't touch the keyboard or mouse while it runs. It presses only F13 to F24, so it can't type into other windows. |
| `npm run perf -- --quick` | Same, about 2 minutes, less exact. |
| `npm run perf -- --only=C` | Only some scenarios: A window open, B with ambience, C hidden in the tray, D on the laptop speakers. |
| `npm run perf -- --args=--disable-gpu` | Try an Electron option, to see whether it helps. |

`perf` writes its last result to `docs/perf-latest.md`. RAM is the private working set summed over every Keyfire
process (Task Manager's Memory column). CPU is a share of the whole machine.

## Limits

| Measure | Limit |
|---|---|
| Idle RAM, one keyboard pack | under 150 MB |
| CPU while typing | under 2% |
| Key press to sound | under 20 ms |
| Cold start | under 2 s |

## Baseline (8-core Windows 11 laptop, one keyboard pack, about 84 words per minute)

| Scenario | Start | Idle RAM | Typing CPU | Key to app | Output delay |
|---|---|---|---|---|---|
| A: window open | 3.2 s | 189 MB | 1.8% | 1 to 2 ms | 52 ms |
| B: plus rain ambience | 2.9 s | 229 MB | 3.5% | 2 to 3 ms | 52 ms |
| C: hidden in the tray | 3.5 s | 185 MB | 4.3% | - | - |
| D: laptop speakers | 2.7 s | 210 MB | 2.5% | 2 ms | 51 ms |

A default profile (shotgun kit, wind ambience, room echo) sits around 300 MB.
Single runs vary by about 25%, so read them as a range.

### Against the limits
- **Cold start:** over (2.7 to 3.5 s).
- **Idle RAM:** over in every case. About a third is the graphics process, a third the window, the rest the main
  and helper processes.
- **Typing CPU:** borderline with one pack, over with ambience or hidden in the tray.
- **Key to sound:** our own code takes 1 to 3 ms. The rest is the audio device delay Chromium reports (about 51 ms on
  both Bluetooth headphones and the laptop speakers). That figure is Chromium's estimate, not a microphone test, so the
  real delay may be lower. Measuring it properly needs a loopback recording.

## Ideas to bring it under the limits (not done yet)
- Try `--disable-gpu` (or `app.disableHardwareAcceleration()`): removes the graphics process. Measure with
  `npm run perf -- --args=--disable-gpu`.
- Stop the interface timers while the window is hidden (typing stats, reactive ambience, focus, health checks).
- Room echo runs a long convolution on every shot; a shorter or cheaper reverb would cut CPU.
- Decode packs lazily and drop unused ones from memory.

## A crash this work found (fixed)
`uiohook-napi` calls our key handlers from native code. If a handler throws, Node aborts the whole process with
`FATAL ERROR: tsfn_to_js_proxy napi_call_function`. Sending a message to a window whose page was reloading or gone
could throw. Every hook handler is now wrapped, and messages go through `toUI`, which skips a missing page.
Crashes are logged to `error.log` in the data folder.
