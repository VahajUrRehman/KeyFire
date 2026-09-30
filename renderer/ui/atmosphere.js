// Atmosphere tab: the ambience bed, extra ambience layers, and music.
import { sk, engine, S, AMBS, TRACKS, $, el, note, paint, ICON, bindSlider, bindRange, setRange, setSlider, replace, on, render } from './core.js';
import { MUSIC_PROFILES } from '../profiles.js';
import { SYNTH_AMBIENCES, forgetAmbience, setAmb, touch } from './library.js';

// ---------------------------------------------------------------- ambience
function renderAmbience() {
  const box = $('#amb');
  box.replaceChildren();
  const bundled = AMBS.filter((a) => !a.removable).map((a) => [a.id, a.name, false]);
  const synth = SYNTH_AMBIENCES.map(([id, label]) => [id, label, false]);
  const mine = AMBS.filter((a) => a.removable).map((a) => [a.id, a.name, true]);
  [['none', 'None', false], ...bundled, ...synth, ...mine].forEach(([id, label, removable]) => {
    const b = el('button', 'chip', label);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', id === S.ambience.type);
    b.addEventListener('click', async () => {
      S.ambience.type = id;
      if (id !== 'none' && S.ambience.volume === 0) S.ambience.volume = 0.4;
      await setAmb(id, S.ambience.volume);
      sk.patch({ ambience: S.ambience });
      touch();
      renderAmbience();
      setSlider('ambVol', 'ambOut', S.ambience.volume);
    });
    if (!removable) { box.append(b); return; }
    const wrap = el('span', 'chipWrap');
    const del = el('button', 'icon');
    del.innerHTML = ICON.trash;
    del.setAttribute('aria-label', 'Remove ' + label);
    del.addEventListener('click', async () => {
      const r = await sk.removeAmbience(id);
      replace(AMBS, r.ambiences);
      forgetAmbience(id);
      if (S.ambience.type === id) { S.ambience.type = 'none'; await setAmb('none', 0); sk.patch({ ambience: S.ambience }); }
      render();
      note(r.note || 'Removed.', !r.ok);
    });
    wrap.append(b, del);
    box.append(wrap);
  });
}

// ------------------------------------------------------------------ layers
let layerCount = 0;

/** Sync the engine's extra slots with S.layers. */
export function applyLayers() {
  for (let i = 0; i < Math.max(layerCount, S.layers.length); i++) {
    setAmb(S.layers[i]?.type || 'none', S.layers[i]?.volume || 0, i + 1);
  }
  layerCount = S.layers.length;
}

function renderLayers() {
  const box = $('#layers');
  box.replaceChildren();
  $('#addLayer').disabled = S.layers.length >= 3;
  const opts = [...AMBS.map((a) => [a.id, a.name]), ...SYNTH_AMBIENCES];
  S.layers.forEach((l, i) => {
    const row = el('div', 'layer');
    const sel = el('select');
    opts.forEach(([id, name]) => sel.append(new Option(name, id)));
    sel.value = l.type;
    sel.setAttribute('aria-label', `Layer ${i + 1} sound`);
    sel.addEventListener('change', () => { l.type = sel.value; sk.patch({ layers: S.layers }); setAmb(l.type, l.volume, i + 1); });
    const vol = el('input');
    Object.assign(vol, { type: 'range', min: 0, max: 100, step: 1, value: Math.round(l.volume * 100) });
    vol.setAttribute('aria-label', `Layer ${i + 1} volume`);
    paint(vol);
    vol.addEventListener('input', () => { paint(vol); l.volume = vol.value / 100; setAmb(l.type, l.volume, i + 1); });
    vol.addEventListener('change', () => sk.patch({ layers: S.layers }));
    const del = el('button', 'icon');
    del.innerHTML = ICON.trash;
    del.setAttribute('aria-label', `Remove layer ${i + 1}`);
    del.addEventListener('click', () => { S.layers.splice(i, 1); sk.patch({ layers: S.layers }); applyLayers(); renderLayers(); });
    row.append(sel, vol, del);
    box.append(row);
  });
}

// ------------------------------------------------------------------- music
const musicEl = engine.music;
const trackName = (f) => f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
const saveMusic = () => sk.patch({ music: S.music });

function setTrack(name, play) {
  S.music.track = name;
  if (!name) { musicEl.removeAttribute('src'); musicEl.load(); S.music.playing = false; }
  else {
    musicEl.src = 'skmusic://t/' + encodeURIComponent(name);
    if (play) { S.music.playing = true; musicEl.play().catch(() => { S.music.playing = false; renderMusic(); }); }
  }
  saveMusic();
  renderMusic();
}

function nextTrack() {
  if (!TRACKS.length) return setTrack(null);
  const i = TRACKS.indexOf(S.music.track);
  const n = S.music.shuffle && TRACKS.length > 1
    ? TRACKS.filter((t) => t !== S.music.track)[Math.floor(Math.random() * (TRACKS.length - 1))]
    : TRACKS[(i + 1) % TRACKS.length];
  setTrack(n, true);
}

function renderMusic() {
  const box = $('#tracks');
  box.replaceChildren();
  TRACKS.forEach((f) => {
    const b = el('button', 'chip', trackName(f));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', f === S.music.track);
    b.addEventListener('click', () => setTrack(f, true));
    const wrap = el('span', 'chipWrap');
    const del = el('button', 'icon');
    del.innerHTML = ICON.trash;
    del.setAttribute('aria-label', 'Remove ' + trackName(f));
    del.addEventListener('click', async () => {
      const r = await sk.removeMusic(f);
      replace(TRACKS, r.tracks);
      if (S.music.track === f) setTrack(null);
      renderMusic();
      note(r.note || 'Removed.', !r.ok);
    });
    wrap.append(b, del);
    box.append(wrap);
  });
  $('#nowPlaying').textContent = S.music.track
    ? (S.music.playing ? 'Playing ' : 'Paused on ') + trackName(S.music.track)
    : (TRACKS.length ? 'Pick a track' : 'Add a track to start');
  $('#musicToggle').textContent = S.music.playing ? 'Pause' : 'Play';
  $('#musicShuffle').setAttribute('aria-pressed', S.music.shuffle);
}

// ------------------------------------------------------------ music profiles
const MUSIC_SLIDERS = [
  ['musicBass', 'musicBassOut', 'bass', (v) => `${v > 0 ? '+' : ''}${v} dB`, 1],
  ['musicTreble', 'musicTrebleOut', 'treble', (v) => `${v > 0 ? '+' : ''}${v} dB`, 1],
  ['musicSoft', 'musicSoftOut', 'soft', (v) => `${v}%`, 100],
  ['musicSpace', 'musicSpaceOut', 'space', (v) => `${v}%`, 100],
  ['musicLevel', 'musicLevelOut', 'level', (v) => `${v}%`, 100],
  ['musicDuckAmt', 'musicDuckOut', 'duck', (v) => `${v}%`, 100],
];

// Compare: bypass the profile so you can hear what it does to your track.
let comparing = false;
function setMusicCompare(on) {
  comparing = on;
  $('#musicCompare').setAttribute('aria-pressed', on);
  $('#musicCompare').textContent = on ? 'Hearing the original' : 'Compare with original';
  engine.setMusicTone(on ? {} : S.music);
}

function renderMusicTone() {
  if (comparing) setMusicCompare(false);
  const box = $('#musicProfiles');
  box.replaceChildren();
  MUSIC_PROFILES.forEach((p) => {
    const b = el('button', 'chip', p.name);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', S.music.profile === p.id);
    b.title = p.note;
    b.addEventListener('click', () => {
      Object.assign(S.music, { profile: p.id, bass: p.bass, treble: p.treble, soft: p.soft, space: p.space, level: p.level, duck: p.duck });
      engine.setMusicTone(S.music);
      saveMusic();
      renderMusicTone();
    });
    box.append(b);
  });
  const cur = MUSIC_PROFILES.find((p) => p.id === S.music.profile);
  $('#musicProfileNote').textContent = cur ? cur.note : 'Custom: your own settings below.';
  for (const [id, out, key, fmt, scale] of MUSIC_SLIDERS) setRange(id, out, Math.round(S.music[key] * scale), fmt);
}

/** Restore the saved track after launch. */
export function restoreMusic() {
  engine.setMusicTone(S.music);
  engine.setMusicVolume(S.music.volume);
  if (S.music.track && !TRACKS.includes(S.music.track)) { S.music.track = null; S.music.playing = false; }
  if (!S.music.track) return;
  musicEl.src = 'skmusic://t/' + encodeURIComponent(S.music.track);
  if (S.music.playing) musicEl.play().catch(() => { S.music.playing = false; renderMusic(); });
}

export function initAtmosphere() {
  bindSlider('ambVol', 'ambOut',
    (v) => { S.ambience.volume = v; setAmb(S.ambience.type, v); touch(); },
    () => sk.patch({ ambience: S.ambience }));
  bindSlider('musicVol', 'musicOut',
    (v) => { S.music.volume = v; engine.setMusicVolume(v); },
    saveMusic);

  $('#addAmb').addEventListener('click', async () => {
    const r = await sk.addAmbience();
    replace(AMBS, r.ambiences);
    if (r.select) {
      S.ambience.type = r.select;
      if (S.ambience.volume === 0) S.ambience.volume = 0.4;
      await setAmb(S.ambience.type, S.ambience.volume);
      sk.patch({ ambience: S.ambience });
      touch();
    }
    render();
    if (r.note) note(r.note, !r.ok);
  });
  $('#addLayer').addEventListener('click', () => {
    S.layers.push({ type: 'rain', volume: 0.3 });
    sk.patch({ layers: S.layers });
    applyLayers();
    renderLayers();
  });

  musicEl.addEventListener('ended', nextTrack);
  musicEl.addEventListener('error', () => {
    if (!S.music.track) return;
    note('That track could not be played.', true);
    S.music.playing = false;
    renderMusic();
  });
  $('#musicToggle').addEventListener('click', () => {
    if (!S.music.track) return TRACKS.length && setTrack(TRACKS[0], true);
    S.music.playing = !S.music.playing;
    if (S.music.playing) musicEl.play().catch(() => {}); else musicEl.pause();
    saveMusic();
    renderMusic();
  });
  for (const [id, out, key, fmt, scale] of MUSIC_SLIDERS) {
    bindRange(id, out, fmt,
      (v) => { if (comparing) setMusicCompare(false); S.music[key] = v / scale; S.music.profile = 'custom'; engine.setMusicTone(S.music); $('#musicProfileNote').textContent = 'Custom: your own settings below.'; },
      () => { saveMusic(); renderMusicTone(); });
  }
  $('#musicCompare').addEventListener('click', () => setMusicCompare(!comparing));
  $('#musicNext').addEventListener('click', nextTrack);
  $('#musicShuffle').addEventListener('click', () => { S.music.shuffle = !S.music.shuffle; saveMusic(); renderMusic(); });
  $('#addMusic').addEventListener('click', async () => {
    const r = await sk.addMusic();
    replace(TRACKS, r.tracks);
    renderMusic();
    if (r.note) note(r.note, !r.ok);
    if (!S.music.track && TRACKS.length) setTrack(TRACKS[0], true);
  });

  on('render', () => {
    renderAmbience();
    renderLayers();
    renderMusic();
    renderMusicTone();
    setSlider('ambVol', 'ambOut', S.ambience.volume);
    setSlider('musicVol', 'musicOut', S.music.volume);
  });
}
