// A loaded pack looks like: { jitter, pick(code) -> {buffer, gain?, rate?}, sample() }

const ENTER = [28, 3612];
const SPACE = [57];
const BACKSPACE = [14];
const MODIFIERS = [42, 54, 29, 3613, 56, 3640, 3675, 3676];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const toArrayBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

function synthPack(engine) {
  const { blasts, boom, pump, shell } = engine.synth;
  return {
    jitter: 0.07,
    pick(code) {
      if (ENTER.includes(code)) return { buffer: pump, gain: 0.9 };
      if (SPACE.includes(code)) return { buffer: boom, gain: 1 };
      if (BACKSPACE.includes(code)) return { buffer: shell, gain: 0.8 };
      if (MODIFIERS.includes(code)) return { buffer: shell, gain: 0.3, rate: 1.4 };
      return { buffer: pickRandom(blasts), gain: 1 };
    },
    sample: () => ({ buffer: pickRandom(blasts), gain: 1 }),
    reload: () => ({ buffer: pump, gain: 0.9 }),   // racked after a burst of fast typing
  };
}

function bankPack(buffers, jitter = 0.05) {
  return {
    jitter,
    pick: () => ({ buffer: pickRandom(buffers) }),
    sample: () => ({ buffer: pickRandom(buffers) }),
  };
}

function keyPack(keymap, generic = [], up = new Map(), genericUp = []) {
  const all = generic.length ? generic : [...keymap.values()];
  return {
    jitter: 0,          // a keyboard pack plays the recording as it is, no pitch wobble
    // key-release sound (V2 "-up" entries), or null when the pack has none
    release(code) {
      const b = up.get(code) || (genericUp.length ? pickRandom(genericUp) : null);
      return b && { buffer: b };
    },
    pick: (code) => ({ buffer: keymap.get(code) || pickRandom(all) }),
    sample: () => ({ buffer: generic.length ? pickRandom(generic) : keymap.get(30) || all[0] }),
  };
}

/** Cut [startMs, startMs+durMs) out of an AudioBuffer, with a 3 ms tail fade. */
function slice(ctx, buf, startMs, durMs) {
  const sr = buf.sampleRate;
  const a = Math.floor((startMs / 1000) * sr);
  const b = Math.min(a + Math.floor((durMs / 1000) * sr), buf.length);
  if (b - a < 64) return null;
  const out = ctx.createBuffer(buf.numberOfChannels, b - a, sr);
  const fade = Math.min(Math.floor(sr * 0.003), b - a);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch).slice(a, b);
    for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
    out.copyToChannel(d, ch);
  }
  return out;
}

async function mechPack(engine, data) {
  const ctx = engine.ctx;
  const { config, files } = data;
  const defines = config.defines || {};
  let mode = config.key_define_type;
  if (!mode) mode = typeof Object.values(defines)[0] === 'string' ? 'multi' : 'single';
  const keymap = new Map();
  const up = new Map();
  const generic = [];
  const genericUp = [];

  if (mode === 'single') {
    const raw = files[config.sound];
    if (!raw) throw new Error('the pack’s sound file is missing');
    const master = await ctx.decodeAudioData(toArrayBuffer(raw));
    for (const [k, v] of Object.entries(defines)) {
      const m = /^(\d+)(-up)?$/.exec(k);
      if (!m || !Array.isArray(v) || v.length < 2) continue;
      const buf = slice(ctx, master, v[0], v[1]);
      if (buf) (m[2] ? up : keymap).set(Number(m[1]), buf);
    }
    genericUp.push(...up.values());
  } else {
    const cache = new Map();
    for (const n of data.generic || []) {
      try { generic.push(await ctx.decodeAudioData(toArrayBuffer(files[n]))); } catch {}
    }
    for (const n of data.genericUp || []) {
      try { genericUp.push(await ctx.decodeAudioData(toArrayBuffer(files[n]))); } catch {}
    }
    for (const [k, v0] of Object.entries(defines)) {
      const m = /^(\d+)(-up)?$/.exec(k);
      if (!m) continue;
      let v = v0;
      if (v && typeof v === 'object' && !Array.isArray(v)) v = v.down || Object.values(v)[0];
      if (typeof v !== 'string' || !files[v]) continue;
      if (!cache.has(v)) {
        try { cache.set(v, await ctx.decodeAudioData(toArrayBuffer(files[v]))); }
        catch { cache.set(v, null); }
      }
      if (cache.get(v)) (m[2] ? up : keymap).set(Number(m[1]), cache.get(v));
    }
  }
  if (!keymap.size && !generic.length) throw new Error('no playable sounds found in this pack');
  return keyPack(keymap, generic, up, genericUp);
}

async function kitPack(engine, data) {
  const ctx = engine.ctx;
  const roles = {};
  for (const [role, files] of Object.entries(data.roles)) {
    roles[role] = [];
    for (const f of files) {
      try { roles[role].push(await ctx.decodeAudioData(toArrayBuffer(f.data))); } catch {}
    }
  }
  if (!roles.blast?.length) throw new Error('the kit has no blast-* sounds');
  const syn = synthPack(engine); // any role without a recording falls back to the synthesized one
  const has = (r) => roles[r]?.length > 0;
  return {
    jitter: 0.04,
    pick(code) {
      if (ENTER.includes(code)) return has('pump') ? { buffer: pickRandom(roles.pump), gain: 0.9 } : syn.pick(code);
      if (SPACE.includes(code)) return has('boom') ? { buffer: pickRandom(roles.boom), gain: 1 } : syn.pick(code);
      if (BACKSPACE.includes(code)) return has('shell') ? { buffer: pickRandom(roles.shell), gain: 0.8 } : syn.pick(code);
      if (MODIFIERS.includes(code)) {
        return has('shell') ? { buffer: pickRandom(roles.shell), gain: 0.3, rate: 1.4 } : syn.pick(code);
      }
      return { buffer: pickRandom(roles.blast), gain: 1 };
    },
    sample: () => ({ buffer: pickRandom(roles.blast), gain: 1 }),
    reload: () => (has('pump') ? { buffer: pickRandom(roles.pump), gain: 0.9 } : syn.reload()),
  };
}

export async function loadPack(id, engine, sk) {
  if (id === 'synth') return synthPack(engine);
  const data = await sk.readPack(id);
  if (data.type === 'kit') return kitPack(engine, data);
  if (data.type === 'files') {
    const buffers = [];
    for (const s of data.sounds) {
      try { buffers.push(await engine.ctx.decodeAudioData(toArrayBuffer(s.data))); } catch {}
    }
    if (!buffers.length) throw new Error('none of those files could be decoded');
    return bankPack(buffers);
  }
  return mechPack(engine, data);
}
