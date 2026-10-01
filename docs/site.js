// Demo keyboard: full layout, every key flashes and plays a real Cherry MX Blue (PBT) clip.
const ROWS = [
  [['`','Backquote'],['1','Digit1'],['2','Digit2'],['3','Digit3'],['4','Digit4'],['5','Digit5'],['6','Digit6'],['7','Digit7'],['8','Digit8'],['9','Digit9'],['0','Digit0'],['-','Minus'],['=','Equal'],['Bksp','Backspace',2]],
  [['Tab','Tab',1.5],['q'],['w'],['e'],['r'],['t'],['y'],['u'],['i'],['o'],['p'],['[','BracketLeft'],[']','BracketRight'],["\\",'Backslash',1.5]],
  [['Caps','CapsLock',1.75],['a'],['s'],['d'],['f'],['g'],['h'],['j'],['k'],['l'],[';','Semicolon'],["'",'Quote'],['Enter','Enter',2.25]],
  [['Shift','ShiftLeft',2.25],['z'],['x'],['c'],['v'],['b'],['n'],['m'],[',','Comma'],['.','Period'],['/','Slash'],['Shift','ShiftRight',2.75]],
  [['Ctrl','ControlLeft',1.25],['Win','MetaLeft',1.25],['Alt','AltLeft',1.25],['','Space',6.25],['Alt','AltRight',1.25],['Win','MetaRight',1.25],['Menu','ContextMenu',1.25],['Ctrl','ControlRight',1.25]],
];
const keys = {}, kb = document.getElementById('kb');
for (const row of ROWS) {
  const r = document.createElement('div'); r.className = 'kr';
  for (const [label, code = 'Key' + label.toUpperCase(), u = 1] of row) {
    const k = document.createElement('div');
    k.className = 'k' + (label.length > 1 || !label ? ' mod' : ''); k.textContent = label; k.style.setProperty('--u', u);
    keys[code] = k; k.dataset.code = code; r.append(k);
  }
  kb.append(r);
}
const letters = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'], bufs = {};
const ctx = new AudioContext(); // starts suspended until first key/click
[...letters, 'space', 'enter'].forEach(async n => {
  try { bufs[n] = await ctx.decodeAudioData(await (await fetch(`audio/${n}.ogg`)).arrayBuffer()); } catch {}
});
function hit(code) {
  const el = keys[code]; if (!el) return;
  el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 110);
  ctx.resume();
  const b = bufs[code === 'Space' ? 'space' : code === 'Enter' ? 'enter' : letters[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % 8]];
  if (!b) return;
  const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = .97 + Math.random() * .06;
  s.connect(ctx.destination); s.start();
}
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !keys[e.code]) return;
  if (e.code === 'Space' && e.target === document.body) e.preventDefault();
  hit(e.code);
});
kb.addEventListener('pointerdown', e => { const k = e.target.closest('.k'); if (k) hit(k.dataset.code); });
