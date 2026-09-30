// ---------------------------------------------------------------- key -> pan
// Left-hand keys sound from the left, right-hand keys from the right.
const ROWS = [
  [1, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 87, 88],
  [41, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 43],
  [58, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 28],
  [42, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54],
];
const PAN = new Map();
for (const row of ROWS) row.forEach((c, i) => PAN.set(c, ((i + 0.5) / row.length * 2 - 1) * 0.55));

// ------------------------------------------------------------------ helpers
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seamlessly loopable stereo noise (the tail is cross-faded into the head). */
function noiseBuffer(ctx, seconds, color) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const fade = Math.floor(sr * 0.4);
  const buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(n + fade);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last * 3.5;
      } else if (color === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else raw[i] = w;
    }
    const out = buf.getChannelData(ch);
    out.set(raw.subarray(0, n));
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      out[i] = raw[i] * t + raw[n + i] * (1 - t);
    }
  }
  return buf;
}

/**
 * Turn any recording into a seamless, level-matched loop: the tail is cross-faded into the head
 * (equal-power), and quiet or loud files are brought to a consistent ambience level.
 */
export function loopBuffer(ctx, buf, fadeSec = 0.6) {
  const sr = buf.sampleRate;
  const N = buf.length;
  const fade = Math.min(Math.floor(sr * fadeSec), Math.floor(N / 4));
  const len = N - fade;
  const out = ctx.createBuffer(buf.numberOfChannels, len, sr);

  let sum = 0, peak = 0, count = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < N; i += 7) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); count++; }
  }
  const rms = Math.sqrt(sum / Math.max(count, 1)) || 1e-6;
  const gain = Math.min(0.1 / rms, 6, 0.9 / (peak || 1));   // target about -20 dBFS, never clip

  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const s = buf.getChannelData(ch);
    const d = out.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = s[i] * gain;
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      d[i] = (s[i] * Math.sqrt(t) + s[len + i] * Math.sqrt(1 - t)) * gain;
    }
  }
  return out;
}

// --------------------------------------------------------- synthesized sounds
export function synthBlast(ctx, pitch = 1, seed = 1, seconds = 0.5, weight = 1) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const r = rng(seed * 7 + ch * 131);
    const d = buf.getChannelData(ch);
    let lp = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const noise = r() * 2 - 1;
      lp += Math.min((0.55 * Math.exp(-t * 26) + 0.05) * pitch, 1) * (noise - lp);
      const body = lp * Math.exp(-t * (11 / weight)) * 2.4;
      ph += (2 * Math.PI * (38 + 90 * Math.exp(-t * 32)) * pitch) / sr;
      const thump = Math.sin(ph) * Math.exp(-t * (13 / weight));
      const crack = noise * Math.exp(-t * 130);
      d[i] = Math.tanh((0.9 * body + 0.9 * thump * weight + 0.7 * crack) * 1.4) * 0.9;
    }
  }
  return buf;
}

/** Pump-action: chk-chk. */
export function synthPump(ctx) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.55);
  const buf = ctx.createBuffer(2, n, sr);
  const hits = [[0, 1, 740], [0.17, 0.85, 610]];
  for (let ch = 0; ch < 2; ch++) {
    const r = rng(9 + ch);
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let s = 0;
      for (const [t0, amp, f] of hits) {
        const u = t - t0;
        if (u < 0) continue;
        s += amp * Math.exp(-u * 55) * (
          0.5 * (r() * 2 - 1) * Math.exp(-u * 40) +
          0.35 * Math.sin(2 * Math.PI * f * u) +
          0.25 * Math.sin(2 * Math.PI * 1780 * u) * Math.exp(-u * 30) +
          0.3 * Math.sin(2 * Math.PI * 95 * u) * Math.exp(-u * 45)
        );
      }
      if (t > 0.03 && t < 0.16) s += 0.12 * (r() * 2 - 1) * Math.sin((Math.PI * (t - 0.03)) / 0.13);
      d[i] = Math.tanh(s * 1.2) * 0.8;
    }
  }
  return buf;
}

/** Brass casing bouncing on a hard floor. */
export function synthShell(ctx) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.55);
  const buf = ctx.createBuffer(2, n, sr);
  const bounces = [[0, 1], [0.1, 0.55], [0.17, 0.25]];
  for (let ch = 0; ch < 2; ch++) {
    const r = rng(31 + ch);
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let s = 0;
      for (const [t0, amp] of bounces) {
        const u = t - t0;
        if (u < 0) continue;
        s += amp * (
          0.4 * Math.sin(2 * Math.PI * 3100 * u) * Math.exp(-u * 26) +
          0.3 * Math.sin(2 * Math.PI * 4650 * u) * Math.exp(-u * 34) +
          0.2 * Math.sin(2 * Math.PI * 5800 * u) * Math.exp(-u * 42) +
          0.25 * (r() * 2 - 1) * Math.exp(-u * 160)
        );
      }
      d[i] = Math.tanh(s) * 0.7;
    }
  }
  return buf;
}

// -------------------------------------------------------------------- engine
const MAX_VOICES = 32;

export class Engine {
  constructor() {
    const ctx = (this.ctx = new AudioContext({ latencyHint: 'interactive' }));
    this.pitchJitter = 0.07;
    this.dynamics = 0.25;
    this.rvSeconds = null;

    this.master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    this.master.connect(limiter).connect(ctx.destination);

    // key sounds: dry + reverb send
    this.keyBus = ctx.createGain();
    this.keyBus.connect(this.master);
    this.send = ctx.createGain();
    this.convolver = ctx.createConvolver();
    this.keyBus.connect(this.send).connect(this.convolver).connect(this.master);

    // tone: bass, presence and treble on every key sound (flat until you change it)
    const eq = (type, freq, q = 0.8) => {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      return f;
    };
    this.toneIn = ctx.createGain();
    this.eqLow = eq('lowshelf', 180);
    this.eqMid = eq('peaking', 3200, 0.9);
    this.eqHigh = eq('highshelf', 7500);
    this.toneIn.connect(this.eqLow).connect(this.eqMid).connect(this.eqHigh).connect(this.keyBus);
    this.pitchMul = 1;
    this.width = 1;

    // ambience bed
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0;
    this.ambBus.connect(this.master);
    this._lv = 0;                                   // current reactive level, 0 to 1
    this.slots = [this._makeSlot(this.ambBus)];     // slot 0 = main bed, 1+ = extra layers

    this.voices = [];
    this.sinkId = '';

    // Near-silent loop (about -70 dB) keeps the output stream and the audio device awake, so the
    // first key after a long idle is instant instead of waiting for the device to spin up.
    const ka = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const kd = ka.getChannelData(0);
    for (let i = 0; i < kd.length; i++) kd[i] = (Math.random() * 2 - 1) * 3e-4;
    const kas = ctx.createBufferSource();
    kas.buffer = ka;
    kas.loop = true;
    kas.connect(ctx.destination);
    kas.start();

    // Stay running, and follow the default output when headphones are plugged or removed.
    ctx.onstatechange = () => this.wake();
    ctx.addEventListener('sinkchange', () => this.wake());
    navigator.mediaDevices?.addEventListener('devicechange', () => this.rebind());
    ctx.addEventListener('error', () => this.rebind());     // the output device failed (headset switched, unplugged)
    // Watchdog: a context that says "running" but whose clock has stopped has lost its output stream.
    let lastT = 0;
    let stuck = 0;
    setInterval(() => {
      if (ctx.state !== 'running') { this.wake(); return; }
      stuck = ctx.currentTime === lastT ? stuck + 1 : 0;
      lastT = ctx.currentTime;
      if (stuck >= 2) { stuck = 0; this.rebind(); }
    }, 3000);

    // music: a streamed <audio> element (long tracks are never decoded into memory)
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.music = new Audio();
    this.music.crossOrigin = 'anonymous';
    ctx.createMediaElementSource(this.music).connect(this.musicBus);

    // built-in shotgun family
    this.synth = {
      blasts: Array.from({ length: 6 }, (_, i) => synthBlast(ctx, 0.85 + i * 0.07, i + 1)),
      boom: synthBlast(ctx, 0.62, 77, 0.8, 1.5),
      pump: synthPump(ctx),
      shell: synthShell(ctx),
    };
  }

  wake() { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  async rebind() { await this.setSink(this.sinkId); }

  /** Pick an output device ('' = system default). Falls back to the default if it's gone. */
  async setSink(id) {
    this.sinkId = id || '';
    try { await this.ctx.setSinkId(this.sinkId); }
    catch { this.sinkId = ''; try { await this.ctx.setSinkId(''); } catch {} }
    this.wake();
  }

  /** For the health panel. */
  stats() {
    const c = this.ctx;
    return { state: c.state, voices: this.voices.length, outMs: ((c.outputLatency || 0) + c.baseLatency) * 1000 };
  }

  /** Whole-output mute (quiet hours, calls, fullscreen, per-app rules). */
  setMuted(m) { this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.08); }

  /** Tone for the current sound: bass, presence, treble in dB; pitch in semitones; width in percent. */
  setTone({ bass = 0, presence = 0, treble = 0, pitch = 0, width = 100 } = {}) {
    const t = this.ctx.currentTime;
    this.eqLow.gain.setTargetAtTime(bass, t, 0.03);
    this.eqMid.gain.setTargetAtTime(presence, t, 0.03);
    this.eqHigh.gain.setTargetAtTime(treble, t, 0.03);
    this.pitchMul = 2 ** (pitch / 12);
    this.width = width / 100;
  }

  /** A soft two-note bell, for focus sessions. */
  chime(kind = 'work') {
    const c = this.ctx;
    if (c.state !== 'running') c.resume();
    const t0 = c.currentTime;
    (kind === 'break' ? [659.25, 523.25] : [523.25, 783.99]).forEach((f, i) => {
      const t = t0 + i * 0.28;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      g.connect(this.master);
      [[f, 1], [f * 2.76, 0.18]].forEach(([freq, amp]) => {
        const o = c.createOscillator();
        const a = c.createGain();
        o.frequency.value = freq;
        a.gain.value = amp;
        o.connect(a).connect(g);
        o.start(t);
        o.stop(t + 1.7);
      });
      setTimeout(() => g.disconnect(), 2200 + i * 300);
    });
  }

  setMusicVolume(v) { this.musicBus.gain.setTargetAtTime(v * 0.8, this.ctx.currentTime, 0.05); }

  setVolume(v) { this.keyBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  setDynamics(v) { this.dynamics = v; }

  setReverb({ mix, seconds }) {
    if (seconds !== this.rvSeconds) {
      this.rvSeconds = seconds;
      this.convolver.buffer = this._impulse(seconds);
    }
    this.send.gain.setTargetAtTime(mix, this.ctx.currentTime, 0.05);
  }

  _impulse(seconds) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * seconds);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        y += ((Math.random() * 2 - 1) - y) * (0.9 - 0.82 * t); // room darkens as it decays
        d[i] = y * Math.pow(1 - t, 2.6);
      }
    }
    return b;
  }

  /** s = { buffer, gain?, rate? } */
  play(s, code, mul = 1) {
    const c = this.ctx;
    if (c.state !== 'running') c.resume();
    if (this.voices.length >= MAX_VOICES) { try { this.voices.shift().stop(); } catch {} } // oldest out
    const src = c.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = (s.rate || 1) * this.pitchMul * (1 + (Math.random() * 2 - 1) * this.pitchJitter);
    const g = c.createGain();
    g.gain.value = (s.gain ?? 1) * mul * (1 - Math.random() * this.dynamics * 0.5);
    const p = c.createStereoPanner();
    p.pan.value = (PAN.get(code) ?? 0) * this.width;
    src.connect(g);
    g.connect(p);
    p.connect(this.toneIn);
    this.voices.push(src);
    src.onended = () => {
      const i = this.voices.indexOf(src);
      if (i >= 0) this.voices.splice(i, 1);
      src.disconnect(); g.disconnect(); p.disconnect();
    };
    src.start();
  }

  // ---------------------------------------------------------------- ambience
  /** type: 'none' | procedural name | 'b:...' / 'u:...' (then `asset` = {buffer, thunder?}) */
  setAmbience(type, volume, asset = null, slot = 0) {
    const now = this.ctx.currentTime;
    let s = this.slots[slot];
    if (!s) {
      const bus = this.ctx.createGain();
      bus.gain.value = 0;
      bus.connect(this.master);
      s = this.slots[slot] = this._makeSlot(bus);
    }
    if (type !== s.type) {
      const old = s.amb;
      if (old) {
        old.out.gain.setTargetAtTime(0, now, 0.5);
        setTimeout(() => old.stop(), 3000);
      }
      s.amb = null;
      s.type = type;
      if (type && type !== 'none') {
        const a = asset ? this._ambienceFile(asset) : this._ambience(type);
        a.out.connect(s.lp);
        a.out.gain.setTargetAtTime(1, now, 0.8);
        s.amb = a;
      }
    }
    s.bus.gain.setTargetAtTime(volume * 0.7, now, 0.3);
  }

  // a bed's output runs through a lowpass and a gain so typing can brighten and swell it (see setReactive)
  _makeSlot(bus) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 18000;
    lp.Q.value = 0.5;
    const react = this.ctx.createGain();
    lp.connect(react).connect(bus);
    return { bus, lp, react, amb: null, type: null };
  }

  /**
   * Ambience that follows typing. level 0..1 is how fast you are typing; swell is how much the bed
   * brightens and grows (0..1); duck is how far it drops under the key sounds (0..1).
   */
  setReactive(level, swell = 0, duck = 0) {
    const t = this.ctx.currentTime;
    const tc = level > this._lv ? 0.04 : 0.5;          // quick to swell, slow to relax
    this._lv = level;
    const rest = 18000 - swell * 15000;
    const freq = rest + (18000 - rest) * level;
    const gain = ((1 - 0.3 * swell) + 0.6 * swell * level) * (1 - duck * 0.6 * level);
    for (const s of this.slots) {
      s.lp.frequency.setTargetAtTime(freq, t, tc);
      s.react.gain.setTargetAtTime(gain, t, tc);
      s.amb?.react?.(swell > 0 ? level : 0, tc);
    }
  }

  /** Crack of thunder from any bed that has one. True if something played. */
  thunder() {
    let hit = false;
    for (const s of this.slots) if (s.amb?.boom) { s.amb.boom(); hit = true; }
    return hit;
  }

  _ambienceFile({ buffer, thunder }) {
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(out);
    src.start();
    const state = { timer: null, alive: true };
    if (thunder) {
      const next = () => {
        state.timer = setTimeout(() => {
          if (!state.alive) return;
          this._thunder(thunder);
          next();
        }, 14000 + Math.random() * 36000);
      };
      next();
    }
    return {
      out,
      boom: thunder ? () => this._thunder(thunder) : null,
      stop: () => {
        state.alive = false;
        clearTimeout(state.timer);
        try { src.stop(); } catch {}
      },
    };
  }

  _thunder(buffer) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const g = c.createGain();
    g.gain.value = 0.55 + Math.random() * 0.35;
    const p = c.createStereoPanner();
    p.pan.value = Math.random() * 1.2 - 0.6;
    src.connect(g);
    g.connect(p);
    p.connect(this.ambBus);
    src.onended = () => { src.disconnect(); g.disconnect(); p.disconnect(); };
    src.start();
  }

  _ambience(type) {
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0;
    const stops = [];
    const loop = (color, secs) => {
      const s = c.createBufferSource();
      s.buffer = noiseBuffer(c, secs, color);
      s.loop = true;
      s.start();
      stops.push(() => s.stop());
      return s;
    };
    const lfo = (freq, depth, param) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = freq;
      g.gain.value = depth;
      o.connect(g).connect(param);
      o.start();
      stops.push(() => o.stop());
    };
    const filter = (kind, freq, q = 0.7) => {
      const f = c.createBiquadFilter();
      f.type = kind; f.frequency.value = freq; f.Q.value = q;
      return f;
    };
    const gain = (v) => { const g = c.createGain(); g.gain.value = v; return g; };
    let react = null;   // how this bed responds to typing speed (level 0..1)

    if (type === 'wind') {
      const bp = filter('bandpass', 420);
      const g = gain(0.9);
      loop('brown', 8).connect(bp).connect(g).connect(out);
      lfo(0.11, 220, bp.frequency);
      lfo(0.07, 0.35, g.gain);
      react = (l, tc) => g.gain.setTargetAtTime(0.6 + 0.8 * l, c.currentTime, tc);
    } else if (type === 'rain') {
      const body = gain(0.8), hiss = gain(0.1);
      loop('pink', 8).connect(filter('lowpass', 6500)).connect(body).connect(out);
      loop('white', 6).connect(filter('highpass', 5200)).connect(hiss).connect(out);
      lfo(0.05, 0.12, body.gain);
      react = (l, tc) => {
        body.gain.setTargetAtTime(0.55 + 0.6 * l, c.currentTime, tc);
        hiss.gain.setTargetAtTime(0.05 + 0.25 * l, c.currentTime, tc);
      };
    } else if (type === 'night') {
      loop('pink', 8).connect(filter('lowpass', 1800)).connect(gain(0.16)).connect(out);
      const master = gain(0.05);
      master.connect(out);
      [4200, 4310].forEach((f, i) => {
        const o = c.createOscillator();
        o.frequency.value = f;
        const am = gain(0.5);
        const group = gain(0.5);
        lfo(29 + i * 1.7, 0.5, am.gain);
        lfo(2.1 + i * 0.3, 0.5, group.gain);
        o.connect(am).connect(group).connect(master);
        o.start();
        stops.push(() => o.stop());
      });
    } else if (type === 'room') {
      loop('brown', 8).connect(filter('lowpass', 160)).connect(gain(1.2)).connect(out);
      loop('pink', 8).connect(filter('lowpass', 900)).connect(gain(0.06)).connect(out);
    }
    return { out, react, stop: () => stops.forEach((s) => { try { s(); } catch {} }) };
  }
}
