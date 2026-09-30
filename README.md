# Keyfire

Every keystroke fires. Scenes, ambience, and Mechvibes-compatible keyboard packs. Windows, Electron.

## Run

    npm install
    npm start

## Build a Windows installer

    npm run dist

The installer is written to `dist/`. Unsigned builds show a SmartScreen warning the first time.

## Use

- **F9** pauses / resumes from anywhere. Closing the window keeps it running in the tray.
- **Scenes** load a sound + ambience + room in one click. "Save current" stores your own.
- **Ambience**: recorded rain, storm (with thunder), highway and running water are bundled, plus synthesized
  wind / soft rain / night / room tone. **Ambience > Add** loops any .ogg/.wav/.mp3 (auto-levelled, seamless).
- **Shotgun, recorded** uses the bundled CC0 kit; drop `blast-*`, `boom-*`, `pump-*`, `shell-*` files in
  Settings > Open kit folder to override any role. See SOUND-SOURCES.md for licensed downloads.
- **Sounds > Add** imports a Mechvibes pack (.zip or folder; pick a parent folder to import many at once)
  or loose .ogg / .wav / .mp3 files.
- In the shotgun sound: Enter = pump action, Space = heavy boom, Backspace = shell drop,
  modifier keys = soft brass tick.
- Library and settings live in `%APPDATA%\Keyfire` (Settings > Open folder).

## Layout

    main.js            window, tray, global key hook (uiohook-napi), packs, settings
    preload.js         minimal bridge to the renderer
    renderer/audio.js  Web Audio engine: synth sounds, reverb, panning, ambience
    renderer/packs.js  synth / your files / Mechvibes pack loading
    renderer/scenes.js built-in scenes
    renderer/app.js    UI logic
