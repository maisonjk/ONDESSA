#!/usr/bin/env node
'use strict';
/**
 * Ondessa end-to-end runner.
 *
 *   node e2e/run.cjs                 # run everything against ONDESSA_URL (default http://localhost:4500)
 *   node e2e/run.cjs privacy tour    # only tests whose "file > name" contains any of these words
 *   node e2e/run.cjs --serve         # build (VITE_PREVIEW_PASS=true) and serve on :4500 first
 *
 * Each test file in e2e/tests exports an array of { name, run, bug?, timeout? }.
 * A test with `bug: 'BUG-xx'` documents a known defect (see e2e/README.md): its failure is
 * reported as KNOWN and does not fail the run; if it starts passing it is reported as FIXED?.
 * After every test the runner fails it if any page logged a console error, threw, or made a
 * request to anything other than localhost.
 */
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const L = require('./lib.cjs');

const args = process.argv.slice(2);
const serve = args.includes('--serve');
const filters = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());

function withTimeout(p, ms, label) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`timeout after ${ms} ms: ${label}`)), ms); })])
    .finally(() => clearTimeout(t));
}

async function waitForServer(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  let server;
  if (serve) {
    const root = path.resolve(__dirname, '..');
    const out = '/tmp/ondessa-e2e-dist';
    console.log('Building preview build…');
    execSync(`npx vite build --outDir ${out} --emptyOutDir`, { cwd: root, stdio: 'ignore', env: { ...process.env, VITE_PREVIEW_PASS: 'true' } });
    server = spawn('npx', ['vite', 'preview', '--outDir', out, '--port', '4500', '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
  }
  if (!(await waitForServer(L.BASE))) {
    console.error(`No server at ${L.BASE}. Start one (see e2e/README.md) or pass --serve.`);
    process.exit(2);
  }

  const dir = path.join(__dirname, 'tests');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.cjs')).sort();
  const results = [];
  const started = Date.now();
  for (const file of files) {
    const tests = require(path.join(dir, file));
    for (const t of tests) {
      const id = `${file.replace(/\.cjs$/, '')} > ${t.name}`;
      if (filters.length && !filters.some((f) => id.toLowerCase().includes(f))) continue;
      const t0 = Date.now();
      let error;
      try {
        await withTimeout(t.run(), t.timeout || 90000, id);
      } catch (e) {
        error = e;
      }
      // Global hygiene checks on every page the test opened.
      for (const o of L.drainOpened()) {
        if (!error) {
          if (o.mon.pageErrors.length) error = new Error(`uncaught page error: ${o.mon.pageErrors[0]}`);
          else if (o.mon.consoleErrors.length && !o.allowConsoleErrors) error = new Error(`console error: ${o.mon.consoleErrors[0]}`);
          else if (o.mon.external.length) error = new Error(`request left localhost: ${o.mon.external[0]}`);
        }
        await o.ctx.close().catch(() => {});
      }
      const ms = Date.now() - t0;
      let status;
      if (t.bug) status = error ? 'KNOWN' : 'FIXED?';
      else status = error ? 'FAIL' : 'PASS';
      results.push({ id, status, bug: t.bug, error, ms });
      const tag = { PASS: 'PASS  ', FAIL: 'FAIL  ', KNOWN: 'KNOWN ', 'FIXED?': 'FIXED?' }[status];
      console.log(`${tag} ${id}${t.bug ? `  [${t.bug}]` : ''}  (${ms} ms)`);
      if (error && (status === 'FAIL' || process.env.VERBOSE)) console.log(`       ${String(error.stack || error).split('\n').slice(0, 4).join('\n       ')}`);
    }
  }
  await L.closeBrowser();
  if (server) { try { process.kill(-server.pid); } catch { /* already gone */ } }

  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\n${results.length} tests in ${Math.round((Date.now() - started) / 1000)} s: ${count('PASS')} passed, ${count('FAIL')} failed, ${count('KNOWN')} known bugs, ${count('FIXED?')} known bugs now passing`);
  if (count('FIXED?')) console.log('Known-bug tests now passing (remove their `bug` tag once confirmed):\n  ' + results.filter((r) => r.status === 'FIXED?').map((r) => `${r.id} [${r.bug}]`).join('\n  '));
  process.exit(count('FAIL') ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
