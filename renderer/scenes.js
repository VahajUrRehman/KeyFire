// A scene = a sound + an ambience + a room. "mech:any" means: the first keyboard pack installed.
// Ambience ids: procedural (wind, rain, night, room) or recorded (b:...). Missing ones fall back gracefully.
export const SCENES = [
  {
    id: 'range', name: 'Range day',
    blurb: 'Open air, a light wind, shots that carry.',
    pack: 'kit', ambience: 'wind', ambVol: 0.35, reverb: { mix: 0.28, seconds: 1.6 },
  },
  {
    id: 'canyon', name: 'Canyon',
    blurb: 'Long echoes rolling off the walls.',
    pack: 'kit', ambience: 'wind', ambVol: 0.25, reverb: { mix: 0.55, seconds: 3.4 },
  },
  {
    id: 'storm', name: 'Storm',
    reactive: { on: true, sens: 0.6, swell: 0.7, duck: 0.2, thunder: true },
    blurb: 'Rain on the roof and thunder rolling in.',
    pack: 'kit', ambience: 'b:storm', ambVol: 0.55, reverb: { mix: 0.22, seconds: 1.1 },
  },
  {
    id: 'night', name: 'Night watch',
    blurb: 'Crickets and a quiet, close report.',
    pack: 'kit', ambience: 'night', ambVol: 0.4, reverb: { mix: 0.15, seconds: 0.9 },
  },
  {
    id: 'rainy-desk', name: 'Rainy desk',
    reactive: { on: true, sens: 0.6, swell: 0.5, duck: 0.15, thunder: false },
    blurb: 'Clicky keys with rain against the window.',
    pack: 'mech:any', ambience: 'b:rain-recorded', ambVol: 0.45, reverb: { mix: 0.12, seconds: 0.8 },
  },
  {
    id: 'night-shift', name: 'Night shift',
    blurb: 'Keys and distant traffic, late at the desk.',
    pack: 'mech:any', ambience: 'b:highway', ambVol: 0.4, reverb: { mix: 0.1, seconds: 0.7 },
  },
  {
    id: 'quiet-desk', name: 'Quiet desk',
    blurb: 'Just the keys. No room, no ambience.',
    pack: 'mech:any', ambience: 'none', ambVol: 0, reverb: { mix: 0, seconds: 0.8 },
  },
];
