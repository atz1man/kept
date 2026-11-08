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
 * Recovery screen saying it could not render.
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
  for (const l of lines.filter((x) => /⚡️\s+\[error\]/.test(x))) problems.push(`console.error: ${l.trim()}`);
  return { pluginCalls, warnings, problems };
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

  let log = '';
  const child = spawn('xcrun', ['simctl', 'launch', '--console-pty', '--terminate-running-process', phone.udid, appId]);
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  const deadline = Date.now() + 90_000;
  while (!launchSettled(log) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
  // Let the first screen paint and any late startup error arrive.
  await new Promise((r) => setTimeout(r, 6000));

  const running = xcrun('spawn', phone.udid, 'launchctl', 'list').includes(appId);
  mkdirSync(dirname(shot), { recursive: true });
  xcrun('io', phone.udid, 'screenshot', '--type=png', shot);
  child.kill();

  console.log('--- app console ---');
  console.log(log.trim());
  console.log('-------------------');

  const { pluginCalls, warnings, problems } = readLaunchLog(log);
  if (!running) problems.push('the app is not running any more');
  const colours = sampledColours(decodePng(shot));
  if (colours < MIN_COLOURS) problems.push(`the screenshot is ${colours} colour(s): nothing was drawn`);

  for (const w of warnings) console.log(`! ${w}`);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
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
