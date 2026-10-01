// Demo keyboard: flash key on real keypress, tiny synthesized click. No audio files.
const keys = {};
document.querySelectorAll('.k').forEach(k => { keys[k.dataset.k || k.textContent.toLowerCase()] = k; });
let ctx;
function blip() {
  try {
    ctx = ctx || new AudioContext();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(220 + Math.random() * 60, t);
    o.frequency.exponentialRampToValueAtTime(50, t + .09);
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .1);
  } catch {}
}
function flash(el) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 110); }
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = keys[e.key === ' ' ? ' ' : e.key.toLowerCase()];
  if (el) { flash(el); blip(); }
});
document.querySelector('.kb').addEventListener('pointerdown', e => {
  const el = e.target.closest('.k'); if (el) { flash(el); blip(); }
});
