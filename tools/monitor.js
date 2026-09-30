// Live monitor for a Keyfire that is already running (installed, or started with npm start).
//   npm run monitor            prints RAM and CPU every few seconds; press Ctrl+C for a summary
// Use the app normally while it runs, then read the summary. Windows only.
const { BUDGETS, CORES, cpuPct, descendants, findRunningKeyfire, sample, flag } = require('./lib/winproc');

const pad = (v, n) => String(v).padStart(n);
const time = () => new Date().toTimeString().slice(0, 8);

function findPids() {
  const mains = findRunningKeyfire();
  return mains.length ? descendants(mains) : [];
}

(async () => {
  let pids = findPids();
  if (!pids.length) {
    console.log('Keyfire is not running. Start it (npm start, or open the installed app) and run this again.');
    process.exit(1);
  }
  console.log(`Keyfire monitor: ${pids.length} processes, ${CORES} cores.  Ctrl+C to stop.`);
  console.log(`Limits: RAM under ${BUDGETS.ramMB} MB when idle, CPU under ${BUDGETS.cpuPct}% while typing (share of the whole machine).\n`);
  console.log('time       RAM MB   CPU %   procs   biggest');

  const rows = [];
  let prev = sample(pids);
  const stop = () => {
    if (rows.length) {
      const ram = rows.map((r) => r.ram);
      const cpu = rows.map((r) => r.cpu);
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      console.log('\nSummary over', rows.length, 'samples');
      console.log(`  RAM  min ${Math.min(...ram).toFixed(0)}  avg ${avg(ram).toFixed(0)}  max ${Math.max(...ram).toFixed(0)} MB   [${flag(Math.max(...ram), BUDGETS.ramMB)}] idle limit ${BUDGETS.ramMB} MB`);
      console.log(`  CPU  min ${Math.min(...cpu).toFixed(2)}  avg ${avg(cpu).toFixed(2)}  max ${Math.max(...cpu).toFixed(2)} %   [${flag(avg(cpu), BUDGETS.cpuPct)}] typing limit ${BUDGETS.cpuPct}%`);
      console.log('  (RAM is the private working set summed over every Keyfire process.)');
    }
    process.exit(0);
  };
  process.on('SIGINT', stop);

  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      if (rows.length % 5 === 4) pids = findPids();          // pick up processes that came and went
      if (!pids.length) { console.log('Keyfire closed.'); stop(); }
      const now = sample(pids);
      const row = { ram: now.ramMB, cpu: cpuPct(prev, now) };
      rows.push(row);
      console.log(`${time()}   ${pad(row.ram.toFixed(0), 6)}   ${pad(row.cpu.toFixed(2), 5)}   ${pad(pids.length, 5)}   ${now.procs.slice(0, 2).map((p) => p.mb + ' MB').join(', ')}`);
      prev = now;
    } catch { /* a process ended between two readings; try again */ }
  }
})();
