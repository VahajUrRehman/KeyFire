// Benchmark: launches Keyfire with a throw-away profile, types into it, and reports start-up time, RAM, CPU
// and key-to-sound delay against the Phase 8 limits in ROADMAP.md.
//
//   npm run perf                 full run (about 5 minutes)
//   npm run perf -- --quick      shorter, less exact (about 2 minutes)
//   npm run perf -- --only=AC    run only some scenarios (A B C D, see below)
//   npm run perf -- --args=--disable-gpu   extra options for Electron, to try an idea
//
// Do not use the keyboard or mouse while it runs. It presses only the F13 to F24 keys, which almost nothing
// uses, so it will not type into other windows. Windows only. Results are also saved to docs/perf-latest.md.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { BUDGETS, CORES, ps, descendants, sample, cpuPct, flag } = require('./lib/winproc');

const ROOT = path.join(__dirname, '..');
const electron = require(path.join(ROOT, 'node_modules', 'electron'));
const { uIOhook, UiohookKey } = require(path.join(ROOT, 'node_modules', 'uiohook-napi'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const QUICK = process.argv.includes('--quick');
const ONLY = (arg('only') || 'ABCD').toUpperCase();
const EXTRA = (arg('args') || '').split(' ').filter(Boolean);
const SETTLE = QUICK ? 6000 : 12000;
const IDLE = QUICK ? 10000 : 20000;
const TYPE = QUICK ? 12 : 25;

const FKEYS = ['F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24'].map((n) => UiohookKey[n]);
const press = (i) => uIOhook.keyTap(FKEYS[i % FKEYS.length]);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function connect(port, t0) {
  for (;;) {
    try {
      const page = await new Promise((res, rej) => http.get(`http://127.0.0.1:${port}/json`, (r) => {
        let d = '';
        r.on('data', (c) => { d += c; });
        r.on('end', () => { try { res(JSON.parse(d).find((x) => x.type === 'page')); } catch (e) { rej(e); } });
      }).on('error', rej));
      if (page) return page;
    } catch { /* not up yet */ }
    if (Date.now() - t0 > 30000) throw new Error('Keyfire did not start within 30 s');
    await sleep(30);
  }
}

function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pend = {};
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) pend[m.id](m.result); };
  const ready = new Promise((r) => { ws.onopen = r; });
  const ev = async (expression) => {
    await ready;
    return new Promise((res) => {
      pend[++id] = (r) => res(r?.result?.value);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    });
  };
  return { ev, close: () => ws.close() };
}

async function type(seconds, rate = 7) {            // about 84 words per minute
  const end = Date.now() + seconds * 1000;
  for (let i = 0; Date.now() < end; i++) { press(i); await sleep(1000 / rate); }
}

async function scenario(name, settings, { hideToTray = false, speakers = false } = {}) {
  console.log(`\n> ${name}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kf-perf-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ enabled: true, scene: null, ...settings }));
  const port = 9400 + Math.floor(Math.random() * 400);
  const t0 = Date.now();
  const child = spawn(electron, [ROOT, `--user-data-dir=${dir}`, `--remote-debugging-port=${port}`, ...EXTRA], { stdio: 'ignore' });
  const r = { name };
  try {
    const c = cdp((await connect(port, t0)).webSocketDebuggerUrl);
    while (!(await c.ev('document.querySelectorAll("#scenes .scene").length > 0'))) await sleep(25);   // init finished
    r.startMs = Date.now() - t0;

    if (speakers) {                                                   // the audio device sets its own delay
      const id = await c.ev('navigator.mediaDevices.enumerateDevices().then(d=>(d.find(x=>x.kind==="audiooutput"&&/speakers/i.test(x.label))||{}).deviceId||"")');
      if (id) { await c.ev(`sk.patch({outputDevice:${JSON.stringify(id)}})`); await c.ev('location.reload()'); await sleep(3500); }
      r.device = await c.ev('document.querySelector("#outDev").selectedOptions[0].textContent');
    }
    if (hideToTray) ps(`(Get-Process -Id ${child.pid}).CloseMainWindow() | Out-Null`);   // like the X button: hides to the tray
    await sleep(SETTLE);

    const pids = descendants([child.pid]);
    const a = sample(pids);
    await sleep(IDLE);
    const b = sample(pids);
    r.idle = { ramMB: b.ramMB, cpuPct: cpuPct(a, b), processes: pids.length, top: b.procs.slice(0, 3) };

    const c1 = sample(pids);
    await type(TYPE);
    const c2 = sample(pids);
    r.typing = { ramMB: c2.ramMB, cpuPct: cpuPct(c1, c2) };

    if (!hideToTray) {                                                // key press to "handled in the app", plus the device's own delay
      await c.ev('window.__t=[];new MutationObserver(()=>window.__t.push(Date.now())).observe(document.querySelector("#count"),{childList:true})');
      const lat = [];
      for (let i = 0; i < 40; i++) {
        await c.ev('window.__t.length=0');
        const t = Date.now();
        press(i);
        await sleep(200);
        const seen = await c.ev('window.__t.pop()||0');
        if (seen) lat.push(seen - t);
        await sleep(100);
      }
      await c.ev('document.querySelector("[data-tab=settings]").click()');
      await sleep(1500);
      const audio = await c.ev('document.querySelector("#hAudio").textContent');
      const m = /(\d+) ms output delay/.exec(audio || '');
      r.keyToApp = lat.length ? median(lat) : null;
      r.output = m ? Number(m[1]) : null;
      r.keyToSound = r.keyToApp != null && r.output != null ? r.keyToApp + r.output : null;
    }
    c.close();
  } finally {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* already gone */ }
    await sleep(800);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* still closing */ }
  }
  console.log(`  start ${r.startMs} ms | idle ${r.idle.ramMB.toFixed(0)} MB, ${r.idle.cpuPct.toFixed(2)}% | typing ${r.typing.cpuPct.toFixed(2)}%`);
  return r;
}

function report(results) {
  const f = (v, d = 0) => (v == null ? 'n/a' : v.toFixed(d));
  const lines = [];
  lines.push('| Scenario | Start | Idle RAM | Idle CPU | Typing CPU | Key to app | Output delay | Key to sound |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.startMs} ms ${flag(r.startMs, BUDGETS.startMs)} | ${f(r.idle.ramMB)} MB ${flag(r.idle.ramMB, BUDGETS.ramMB)} | ${f(r.idle.cpuPct, 2)}% | ${f(r.typing.cpuPct, 2)}% ${flag(r.typing.cpuPct, BUDGETS.cpuPct)} | ${r.keyToApp ?? 'n/a'} ms | ${r.output ?? 'n/a'} ms | ${r.keyToSound ?? 'n/a'} ms ${r.keyToSound == null ? '' : flag(r.keyToSound, BUDGETS.keyToSoundMs)} |`);
  }
  return lines.join('\n');
}

(async () => {
  console.log(`Keyfire benchmark${QUICK ? ' (quick)' : ''}. ${CORES} cores. Do not use the keyboard or mouse until it finishes.`);
  console.log(`Limits: start ${BUDGETS.startMs} ms, idle RAM ${BUDGETS.ramMB} MB, typing CPU ${BUDGETS.cpuPct}%, key to sound ${BUDGETS.keyToSoundMs} ms.`);
  if (EXTRA.length) console.log('Extra Electron options:', EXTRA.join(' '));
  await sleep(4000);

  const pack = { pack: 'mech:cherrymx-blue-abs', ambience: { type: 'none', volume: 0 } };
  const results = [];
  if (ONLY.includes('A')) results.push(await scenario('A: window open, one keyboard pack', pack));
  if (ONLY.includes('B')) results.push(await scenario('B: window open, pack + rain ambience', { ...pack, ambience: { type: 'b:rain-recorded', volume: 0.35 } }));
  if (ONLY.includes('C')) results.push(await scenario('C: hidden in the tray, one pack', pack, { hideToTray: true }));
  if (ONLY.includes('D')) results.push(await scenario('D: window open, laptop speakers', pack, { speakers: true }));

  const table = report(results);
  console.log('\n' + table);
  console.log('\nRAM is the private working set over every Keyfire process. CPU is a share of the whole machine.');
  console.log('"Key to sound" = key to app + the audio device delay Chromium reports. It is an estimate, not a microphone test.');

  const dir = path.join(ROOT, 'docs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'perf-latest.md'), `# Latest performance run\n\n${new Date().toISOString()} on ${os.cpus()[0].model.trim()}, ${CORES} cores${EXTRA.length ? `, options: ${EXTRA.join(' ')}` : ''}.\n\n${table}\n`);
  console.log('\nSaved to docs/perf-latest.md');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
