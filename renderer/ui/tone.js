// Sounds tab: tone (per sound) and typing feel (loudness follows typing speed).
import { sk, engine, S, PACKS, $, bindRange, setRange, on } from './core.js';

const DEFAULT_TONE = { bass: 0, presence: 0, treble: 0, pitch: 0, width: 100 };
const db = (v) => `${v > 0 ? '+' : ''}${v} dB`;
const st = (v) => `${v > 0 ? '+' : ''}${v} semitones`;
const pct = (v) => `${v}%`;
const FIELDS = [
  ['toneBass', 'toneBassOut', 'bass', db],
  ['tonePresence', 'tonePresenceOut', 'presence', db],
  ['toneTreble', 'toneTrebleOut', 'treble', db],
  ['tonePitch', 'tonePitchOut', 'pitch', st],
  ['toneWidth', 'toneWidthOut', 'width', pct],
];

const current = () => ({ ...DEFAULT_TONE, ...S.tone[S.pack] });

function renderTone() {
  const t = current();
  for (const [id, out, key, fmt] of FIELDS) setRange(id, out, t[key], fmt);
  $('#toneFor').textContent = PACKS.find((p) => p.id === S.pack)?.name || '';
  $('#intMode').value = S.intensity.mode;
  setRange('intAmt', 'intAmtOut', Math.round(S.intensity.amount * 100), pct);
  $('#intAmt').disabled = S.intensity.mode === 'off';
}

export function initTone() {
  for (const [id, out, key, fmt] of FIELDS) {
    bindRange(id, out, fmt,
      (v) => { S.tone[S.pack] = { ...current(), [key]: v }; engine.setTone(S.tone[S.pack]); },
      () => sk.patch({ tone: S.tone }));
  }
  $('#toneReset').addEventListener('click', () => {
    delete S.tone[S.pack];
    engine.setTone(DEFAULT_TONE);
    sk.patch({ tone: S.tone });
    renderTone();
  });

  const saveInt = () => sk.patch({ intensity: S.intensity });
  $('#intMode').addEventListener('change', (e) => { S.intensity.mode = e.target.value; saveInt(); renderTone(); });
  bindRange('intAmt', 'intAmtOut', pct, (v) => { S.intensity.amount = v / 100; }, saveInt);

  on('render', renderTone);
  on('tone', renderTone);   // the sound changed
}
