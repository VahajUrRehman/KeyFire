// Sounds tab: tone (per sound) and typing feel (loudness follows typing speed).
import { sk, engine, S, PACKS, app, $, el, bindRange, setRange, on, label } from './core.js';
import { TONE_PROFILES, matchTone } from '../profiles.js';

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

// Compare: bypass the tone (and pitch and width) so you can hear what you changed.
let comparing = false;
function setCompare(on) {
  comparing = on;
  $('#toneCompare').setAttribute('aria-pressed', on);
  label($('#toneCompare'), 'scale', on ? 'Hearing the original' : 'Compare with original');
  engine.setTone(on ? DEFAULT_TONE : S.tone[S.pack]);
}

function renderProfiles() {
  const box = $('#toneProfiles');
  box.replaceChildren();
  const active = matchTone(current());
  TONE_PROFILES.forEach((p) => {
    const b = el('button', 'chip', p.name);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', active?.id === p.id);
    b.title = p.note;
    b.addEventListener('click', () => {
      S.tone[S.pack] = { bass: p.bass, presence: p.presence, treble: p.treble, pitch: p.pitch, width: p.width };
      engine.setTone(S.tone[S.pack]);
      sk.patch({ tone: S.tone });
      renderTone();
      playSample();                       // hear the profile straight away
    });
    box.append(b);
  });
  $('#toneProfileNote').textContent = active ? active.note : 'Custom: your own settings below.';
}

function playSample() {
  if (!app.pack) return;
  engine.wake();
  engine.play(app.pack.sample(), 30);
}

function renderTone() {
  if (comparing) setCompare(false);      // any change ends the comparison
  renderProfiles();
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
      (v) => { if (comparing) { comparing = false; $('#toneCompare').setAttribute('aria-pressed', false); label($('#toneCompare'), 'scale', 'Compare with original'); } S.tone[S.pack] = { ...current(), [key]: v }; engine.setTone(S.tone[S.pack]); },
      () => { sk.patch({ tone: S.tone }); renderProfiles(); });
  }
  $('#toneSample').addEventListener('click', playSample);
  $('#toneCompare').addEventListener('click', () => { setCompare(!comparing); playSample(); });
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
