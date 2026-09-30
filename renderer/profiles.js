// Built-in sound profiles, like the presets on a music equalizer.

// Key sounds: bass, presence and treble in dB; pitch in semitones; stereo width in percent.
export const TONE_PROFILES = [
  { id: 'flat',    name: 'Flat',            note: 'The sound as recorded.',                           bass: 0,  presence: 0,  treble: 0,  pitch: 0,  width: 100 },
  { id: 'thock',   name: 'Deep thock',      note: 'Low and round. Sounds bigger than the keys are.',  bass: 6,  presence: -2, treble: -4, pitch: -2, width: 100 },
  { id: 'clicky',  name: 'Crisp and clicky', note: 'A bright, sharp attack.',                          bass: -2, presence: 4,  treble: 5,  pitch: 0,  width: 100 },
  { id: 'warm',    name: 'Warm',            note: 'Softer edges and more body.',                      bass: 4,  presence: -1, treble: -3, pitch: 0,  width: 100 },
  { id: 'bright',  name: 'Bright',          note: 'Airy and sparkling.',                              bass: 0,  presence: 2,  treble: 6,  pitch: 0,  width: 100 },
  { id: 'soft',    name: 'Soft and quiet',  note: 'Muted and gentle, good for a shared room.',        bass: 2,  presence: -4, treble: -8, pitch: 0,  width: 100 },
  { id: 'punch',   name: 'Punchy',          note: 'Weight and snap. Great for the shotgun.',          bass: 8,  presence: 3,  treble: 0,  pitch: -1, width: 110 },
  { id: 'wide',    name: 'Wide',            note: 'Spread across the stereo field.',                  bass: 0,  presence: 0,  treble: 1,  pitch: 0,  width: 150 },
  { id: 'vintage', name: 'Vintage',         note: 'Small and tinny, like an old machine.',            bass: -8, presence: 3,  treble: 2,  pitch: 2,  width: 80 },
];

// Music: bass and treble in dB; soft (how much the top end is rolled off), space (a wash of room reverb)
// and duck (how far it steps aside while you type) from 0 to 1; level is a loudness trim.
export const MUSIC_PROFILES = [
  { id: 'flat',       name: 'Original',   note: 'Your music, untouched.',                                        bass: 0,  treble: 0,  soft: 0,    space: 0,    level: 1,    duck: 0 },
  { id: 'ambient',    name: 'Ambient',    note: 'Soft, washed and spacious. Turns any track into an atmosphere.', bass: 2,  treble: -5, soft: 0.45, space: 0.55, level: 0.85, duck: 0.15 },
  { id: 'background', name: 'Background', note: 'Quiet and mellow, like a room next door. Steps aside while you type.', bass: -2, treble: -7, soft: 0.6, space: 0.12, level: 0.7, duck: 0.5 },
  { id: 'lofi',       name: 'Lo-fi',      note: 'Warm, dusty and rolled off.',                                   bass: 4,  treble: -6, soft: 0.5,  space: 0.1,  level: 0.9,  duck: 0.2 },
  { id: 'warm',       name: 'Warm',       note: 'Fuller lows, gentler highs.',                                   bass: 5,  treble: -3, soft: 0.15, space: 0.05, level: 1,    duck: 0 },
  { id: 'bright',     name: 'Bright',     note: 'Clearer and more open.',                                        bass: -2, treble: 5,  soft: 0,    space: 0,    level: 1,    duck: 0 },
  { id: 'bass',       name: 'Bass boost', note: 'More thump underneath.',                                        bass: 9,  treble: 0,  soft: 0,    space: 0,    level: 0.9,  duck: 0 },
  { id: 'night',      name: 'Night',      note: 'Low, dim and quiet for late hours.',                            bass: -3, treble: -5, soft: 0.55, space: 0.2,  level: 0.55, duck: 0.4 },
];

const same = (a, b, keys) => keys.every((k) => Math.abs((a[k] ?? 0) - b[k]) < 0.001);

/** The profile whose values match the current tone, or null when it has been tweaked. */
export const matchTone = (tone) => TONE_PROFILES.find((p) => same({ width: 100, ...tone }, p, ['bass', 'presence', 'treble', 'pitch', 'width'])) || null;
