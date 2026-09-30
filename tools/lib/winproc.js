// Helpers for measuring Keyfire's processes on Windows (used by tools/perf.js and tools/monitor.js).
const { execFileSync } = require('child_process');
const os = require('os');

const CORES = os.cpus().length;

// The limits from ROADMAP.md, Phase 8.
const BUDGETS = {
  ramMB: 150,        // idle RAM with one keyboard pack
  cpuPct: 2,         // CPU while typing, as a share of the whole machine (what Task Manager shows)
  keyToSoundMs: 20,  // key press to sound
  startMs: 2000,     // cold start to a usable window
};

const ps = (script) => execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8', windowsHide: true });
const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

/** The process plus every child, grandchild and so on. */
function descendants(rootPids) {
  const rows = arr(JSON.parse(ps('Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress')));
  const pids = new Set(rootPids);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of rows) if (pids.has(r.ParentProcessId) && !pids.has(r.ProcessId)) { pids.add(r.ProcessId); grew = true; }
  }
  return [...pids];
}

/**
 * Finds a Keyfire that is already running: the installed Keyfire.exe, or a dev copy started with npm start.
 * Returns the pids of its top-level processes (the ones whose children are the rest), or [] when it isn't running.
 */
function findRunningKeyfire() {
  const all = arr(JSON.parse(ps('Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress')));
  const byPid = new Map(all.map((p) => [p.ProcessId, p]));
  const electronish = (p) => /^(Keyfire|electron)(\.exe)?$/i.test(p.Name);
  // Installed: named Keyfire. Dev copy: an electron process whose command line mentions the app. The main
  // process of a dev copy has no path in its command line, but its children do, so climb up to it.
  const ours = all.filter((p) => /^Keyfire/i.test(p.Name) || (/^electron(\.exe)?$/i.test(p.Name) && /Keyfire|shotgun-keys/i.test(p.CommandLine || '')));
  const roots = new Set();
  for (const p of ours) {
    let top = p;
    // climb only through Keyfire/Electron parents, never up to the launcher (Explorer, a shell, npm)
    while (byPid.get(top.ParentProcessId) && electronish(byPid.get(top.ParentProcessId))) top = byPid.get(top.ParentProcessId);
    roots.add(top.ProcessId);
  }
  return [...roots];
}

/** RAM (private working set, like Task Manager's Memory column) and CPU seconds for the given pids. */
function sample(pids) {
  const list = pids.join(',');
  const out = ps(`$ids=@(${list}); $m=Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $ids -contains $_.IDProcess } | Select-Object IDProcess,WorkingSetPrivate,Name;
    $c=Get-Process -Id $ids -ErrorAction SilentlyContinue | Select-Object Id,@{n='cpu';e={$_.TotalProcessorTime.TotalSeconds}};
    @{mem=@($m);cpu=@($c)} | ConvertTo-Json -Compress -Depth 4`);
  const j = JSON.parse(out);
  const mem = arr(j.mem);
  return {
    ramMB: mem.reduce((n, p) => n + p.WorkingSetPrivate, 0) / 1048576,
    procs: mem.map((p) => ({ name: p.Name, mb: +(p.WorkingSetPrivate / 1048576).toFixed(1) })).sort((a, b) => b.mb - a.mb),
    cpuSec: arr(j.cpu).reduce((n, p) => n + p.cpu, 0),
    t: Date.now(),
  };
}

/** CPU between two samples as a share of the whole machine. */
const cpuPct = (a, b) => ((b.cpuSec - a.cpuSec) / ((b.t - a.t) / 1000) / CORES) * 100;

const flag = (value, limit) => (value <= limit ? 'ok  ' : 'OVER');

module.exports = { CORES, BUDGETS, ps, descendants, findRunningKeyfire, sample, cpuPct, flag };
