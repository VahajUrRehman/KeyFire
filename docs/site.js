// Demo keyboard: flash key on real keypress and play real Cherry MX Blue (PBT) clips.
const keys = {};
document.querySelectorAll('.k').forEach(k => { keys[k.dataset.k || k.textContent.toLowerCase()] = k; });
const letters = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'], bufs = {};
const ctx = new AudioContext(); // starts suspended until first key/click
[...letters, 'space', 'enter'].forEach(async n => {
  try { bufs[n] = await ctx.decodeAudioData(await (await fetch(`audio/${n}.ogg`)).arrayBuffer()); } catch {}
});
function click(key) {
  ctx.resume();
  const b = bufs[key === ' ' ? 'space' : letters[key.charCodeAt(0) % letters.length]];
  if (!b) return;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = .97 + Math.random() * .06;
  s.connect(ctx.destination); s.start();
}
function hit(key, el) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 110); click(key); }
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key === ' ' ? ' ' : e.key.toLowerCase(), el = keys[k];
  if (el) hit(k, el);
});
document.querySelector('.kb').addEventListener('pointerdown', e => {
  const el = e.target.closest('.k'); if (el) hit(el.dataset.k || el.textContent.toLowerCase(), el);
});
