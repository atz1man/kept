#!/usr/bin/env node
/**
 * Launch the compiled app in the iOS Simulator and check it starts.
 *
 *   node scripts/sim-launch.mjs <path to App.app> <screenshot.png>
 *
 * CI compiled the app on every push and nothing had ever RUN it: the first
 * launch anywhere was going to be on somebody's phone. A build that links and
 * then shows a white screen — a web bundle at the wrong path, a script the
 * WebView refuses, a plugin the bridge cannot find — is green until then.
 *
 * Capacitor writes its own progress to the app's stdout, so the evidence is
 * read from there, not inferred:
 *   "⚡️  Loading app at capacitor://localhost/..."  the bridge started
 *   "⚡️  WebView loaded"                             the document loaded
 *   "⚡️  To Native ->  <Plugin> <method> …"          the app's JavaScript ran
 *                                                    and reached native code
 * and it fails on "STARTUP JS ERROR", "WebView failed", and "[error]", which
 * is how a console.error reaches native — the app's only console.error is the
 * Recovery screen saying it could not render. Capacitor also logs a refused
 * plugin call as "[error]"; of those, only a fresh install's missing files
 * are expected (see FIRST_LAUNCH).
 *
 * A screenshot is taken too, uploaded by CI, and refused if it is one flat
 * colour: a WebView that loaded nothing paints exactly that.
 *
 * Simulator only, so no signing and no App Group container: a plugin that
 * needs the group (the widget snapshot) may warn here, and warnings are
 * printed rather than failed for that reason.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, pixelAt } from './png.mjs';
import { appIdFromConfig } from './check-built-app.mjs';

/**
 * Capacitor's own JavaScript logs every REFUSED plugin call as console.error,
 * with the refusal as JSON carrying `errorMessage`. That is a different thing
 * from the app calling console.error, and the first CI launch showed both
 * kinds side by side. The message of a refused call, or null when the line is
 * the app's own.
 */
export function refusedCall(line) {
  const m = line.match(/⚡️\s+\[error\]\s+-\s+(\{.*\})\s*$/);
  if (!m) return null;
  try {
    const body = JSON.parse(m[1]);
    return typeof body.errorMessage === 'string' ? body.errorMessage : null;
  } catch {
    return null;
  }
}

/**
 * The one refusal a FRESH install must produce: reading the files it has not
 * written yet (the store, its `.next` half-write, the receipts folder). The
 * app expects exactly this and starts empty. Any other refusal fails.
 */
export const FIRST_LAUNCH = /couldn’t be opened because there is no such file/;

/** What the launch log says, as facts and problems. */
export function readLaunchLog(text) {
  const lines = text.split(/\r?\n/);
  const pluginCalls = [];
  for (const line of lines) {
    const m = line.match(/⚡️\s+To Native ->\s+(\S+)\s+(\S+)/);
    if (m) pluginCalls.push(`${m[1]}.${m[2]}`);
  }
  const warnings = lines.filter((l) => /⚡️\s+\[warn\]/.test(l)).map((l) => l.trim());
  const problems = [];
  if (!/⚡️\s+Loading app at capacitor:\/\/localhost/.test(text)) problems.push('the bridge never said it was loading the app');
  if (!/⚡️\s+WebView loaded/.test(text)) problems.push('the WebView never finished loading');
  if (pluginCalls.length === 0) problems.push("the app's JavaScript never reached native code");
  if (/STARTUP JS ERROR/.test(text)) problems.push('a JavaScript error at startup');
  if (/WebView failed/.test(text)) problems.push('the WebView failed to load');
  const expected = [];
  for (const l of lines.filter((x) => /⚡️\s+\[error\]/.test(x))) {
    const rejection = refusedCall(l);
    if (rejection === null) problems.push(`console.error: ${l.trim()}`);
    else if (FIRST_LAUNCH.test(rejection)) expected.push(rejection);
    else problems.push(`a native call was refused: ${rejection}`);
  }
  return { pluginCalls, warnings, expected, problems };
}

/** True once the log holds enough to judge: loaded, and some JS reached native. */
export function launchSettled(text) {
  return /⚡️\s+WebView loaded/.test(text) && /⚡️\s+To Native ->/.test(text);
}

/** Distinct colours on a sampled grid; a blank WebView is one. */
export function sampledColours(image, step = 8) {
  const seen = new Set();
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) seen.add(pixelAt(image, x, y).slice(0, 3).join(','));
  }
  return seen.size;
}

export const MIN_COLOURS = 8;

/** How long one launch may take to settle. */
export const LAUNCH_DEADLINE_MS = 90_000;
/** How long a launch may print nothing at all before it is taken as never started. */
export const SILENT_MS = 45_000;

/**
 * Whether to launch the app again: once, and only when the first launch
 * printed NOTHING — not a line from the bridge, not an error from simctl —
 * for SILENT_MS, and the app is not running.
 *
 * Seen on CI: on a freshly booted iOS 26 simulator, `simctl launch` sat for
 * the whole deadline with no output and the app's icon on the home screen,
 * never opened. That is the simulator not yet taking launches, not the app:
 * an app that starts and then fails prints the bridge's own lines, or a
 * startup error, and is judged on them, never relaunched. So a second try is
 * only for a launch that never began, and the judgement after it is the same.
 */
export function shouldRelaunch({ attempt, output, elapsedMs, appRunning }) {
  return attempt === 1 && output.trim() === '' && elapsedMs >= SILENT_MS && !appRunning;
}

function xcrun(...args) {
  return execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' });
}

/** The newest iOS runtime's first available iPhone. */
function pickIphone() {
  const { devices } = JSON.parse(xcrun('list', 'devices', 'available', '-j'));
  const runtimes = Object.keys(devices)
    .filter((r) => /SimRuntime\.iOS-/.test(r))
    .sort((a, b) => {
      const v = (r) => r.split('iOS-')[1].split('-').map(Number);
      const [x, y] = [v(a), v(b)];
      return y[0] - x[0] || (y[1] ?? 0) - (x[1] ?? 0);
    });
  for (const r of runtimes) {
    const phone = devices[r].find((d) => /^iPhone/.test(d.name));
    if (phone) return { ...phone, runtime: r };
  }
  throw new Error('no iPhone simulator is available');
}

async function main(app, shot) {
  const appId = appIdFromConfig();
  const phone = pickIphone();
  console.log(`Simulator: ${phone.name} (${phone.runtime.split('.').pop()})`);
  try {
    xcrun('boot', phone.udid);
  } catch {
    /* already booted */
  }
  xcrun('bootstatus', phone.udid, '-b');
  xcrun('status_bar', phone.udid, 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100');
  xcrun('install', phone.udid, app);

  const isRunning = () => xcrun('spawn', phone.udid, 'launchctl', 'list').includes(appId);
  let log = '';
  let child;
  for (let attempt = 1; ; attempt += 1) {
    log = '';
    let exited = null;
    child = spawn('xcrun', ['simctl', 'launch', '--console-pty', '--terminate-running-process', phone.udid, appId]);
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    child.on('exit', (code, signal) => (exited = signal ?? code));
    const started = Date.now();
    let retry = false;
    while (!launchSettled(log) && Date.now() - started < LAUNCH_DEADLINE_MS) {
      await new Promise((r) => setTimeout(r, 500));
      const elapsedMs = Date.now() - started;
      if (shouldRelaunch({ attempt, output: log, elapsedMs, appRunning: elapsedMs >= SILENT_MS ? isRunning() : true })) {
        retry = true;
        break;
      }
    }
    if (!retry) break;
    console.log(`! launch ${attempt} printed nothing in ${SILENT_MS / 1000}s and the app was not running${exited === null ? '' : ` (simctl exited: ${exited})`}; launching again`);
    child.kill();
    // What a launch WITHOUT the console says: a process id, or simctl's own
    // error. Seen twice on 22 November with nothing at all from the console
    // form, so the next one that stalls says why.
    try {
      const plain = execFileSync('xcrun', ['simctl', 'launch', '--terminate-running-process', phone.udid, appId], { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`! a plain launch answered: ${plain.trim() || '(nothing)'}`);
    } catch (e) {
      console.log(`! a plain launch failed: ${String(e.stderr || e.message).trim().slice(0, 400)}`);
    }
    try {
      xcrun('terminate', phone.udid, appId);
    } catch {
      /* not running */
    }
  }
  // Let the first screen paint and any late startup error arrive.
  await new Promise((r) => setTimeout(r, 6000));

  const running = isRunning();
  mkdirSync(dirname(shot), { recursive: true });
  xcrun('io', phone.udid, 'screenshot', '--type=png', shot);
  child.kill();

  console.log('--- app console ---');
  console.log(log.trim());
  console.log('-------------------');

  const { pluginCalls, warnings, expected, problems } = readLaunchLog(log);
  for (const e of expected) console.log(`· expected on a fresh install: ${e}`);
  if (!running) problems.push('the app is not running any more');
  const colours = sampledColours(decodePng(shot));
  if (colours < MIN_COLOURS) problems.push(`the screenshot is ${colours} colour(s): nothing was drawn`);

  for (const w of warnings) console.log(`! ${w}`);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    // The simulator's own account of the app, so a failure here is a
    // diagnosis and not only a verdict.
    try {
      const said = xcrun('spawn', phone.udid, 'log', 'show', '--last', '4m', '--style', 'compact',
        '--predicate', `process == "App" OR eventMessage CONTAINS[c] "${appId}"`);
      console.error('--- simulator log about the app (last 40 lines) ---');
      console.error(said.trim().split('\n').slice(-40).join('\n'));
    } catch (e) {
      console.error(`(no simulator log: ${String(e.message).slice(0, 200)})`);
    }
    process.exit(1);
  }
  console.log(`✓ launched on ${phone.name}: JavaScript reached ${[...new Set(pluginCalls)].join(', ')}; ${colours} colours on screen; screenshot at ${shot}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [app, shot] = process.argv.slice(2);
  if (!app || !shot) {
    console.error('usage: node scripts/sim-launch.mjs <path to App.app> <screenshot.png>');
    process.exit(2);
  }
  main(app, shot).catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
