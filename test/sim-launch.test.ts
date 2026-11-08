import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper, run by CI's ios job in the Simulator
import { MIN_COLOURS, launchSettled, readLaunchLog, refusedCall, sampledColours } from '../scripts/sim-launch.mjs';

/**
 * CI's ios job launches the compiled app in the Simulator and judges the
 * launch from what Capacitor writes to the app's stdout. Linux has no
 * Simulator, so the judging is checked here against logs shaped exactly as
 * Capacitor 6 prints them (CAPBridgeViewController and
 * WebViewDelegationHandler), including the ways a launch goes wrong while
 * the build stays green.
 */
const GOOD = [
  '⚡️  Loading app at capacitor://localhost...',
  '⚡️  WebView loaded',
  '⚡️  To Native ->  TextZoom getPreferred 12345678',
  '⚡️  To Native ->  Preferences get 12345679',
  '⚡️  [warn] - widget not updated {}',
].join('\n');

describe('reading the launch log', () => {
  it('passes a launch that loaded and reached native code, and lists what it called', () => {
    const r = readLaunchLog(GOOD);
    expect(r.problems).toEqual([]);
    expect(r.pluginCalls).toEqual(['TextZoom.getPreferred', 'Preferences.get']);
    expect(r.warnings).toEqual(['⚡️  [warn] - widget not updated {}']);
  });

  it('names a WebView that loaded but whose JavaScript never ran', () => {
    const r = readLaunchLog('⚡️  Loading app at capacitor://localhost...\n⚡️  WebView loaded');
    expect(r.problems).toEqual(["the app's JavaScript never reached native code"]);
  });

  it('names a bridge that never started', () => {
    expect(readLaunchLog('').problems).toEqual([
      'the bridge never said it was loading the app',
      'the WebView never finished loading',
      "the app's JavaScript never reached native code",
    ]);
  });

  it('names a startup JavaScript error, as Capacitor prints one', () => {
    const r = readLaunchLog(`${GOOD}\n\n⚡️  ------ STARTUP JS ERROR ------\n\n⚡️  ReferenceError: x is not defined`);
    expect(r.problems).toEqual(['a JavaScript error at startup']);
  });

  it('names the Recovery screen, which is the app saying it could not render', () => {
    const r = readLaunchLog(`${GOOD}\n⚡️  [error] - Quids In could not render: {}`);
    expect(r.problems).toEqual(['console.error: ⚡️  [error] - Quids In could not render: {}']);
  });

  // The first real launch, on CI's iOS 26 simulator, logged these three: a
  // fresh install reading files it has not written yet. Copied verbatim.
  const FRESH = [
    '⚡️  [error] - {"errorMessage":"The file “kept-receipts.json.next” couldn’t be opened because there is no such file.","message":"The file “kept-receipts.json.next” couldn’t be opened because there is no such file."}',
    '⚡️  [error] - {"errorMessage":"The file “kept-receipts.json” couldn’t be opened because there is no such file.","message":"The file “kept-receipts.json” couldn’t be opened because there is no such file."}',
    '⚡️  [error] - {"message":"The file “receipts” couldn’t be opened because there is no such file.","errorMessage":"The file “receipts” couldn’t be opened because there is no such file."}',
  ];

  it('expects a fresh install to find none of its files yet', () => {
    const r = readLaunchLog([GOOD, ...FRESH].join('\n'));
    expect(r.problems).toEqual([]);
    expect(r.expected).toHaveLength(3);
  });

  it('fails any other refused native call', () => {
    const r = readLaunchLog(`${GOOD}\n⚡️  [error] - {"errorMessage":"Plugin is not implemented on ios","message":"x"}`);
    expect(r.problems).toEqual(['a native call was refused: Plugin is not implemented on ios']);
  });

  it("tells Capacitor's refusals from the app's own console.error", () => {
    expect(refusedCall(FRESH[0])).toMatch(/no such file/);
    expect(refusedCall('⚡️  [error] - Quids In could not render: {}')).toBeNull();
    expect(refusedCall('⚡️  [error] - {"not":"a refusal"}')).toBeNull();
  });

  it('names a WebView that failed to load its document', () => {
    const r = readLaunchLog(`⚡️  Loading app at capacitor://localhost...\n⚡️  WebView failed provisional navigation\n⚡️  Error: not found`);
    expect(r.problems).toContain('the WebView failed to load');
  });

  it('does not count Cordova calls or the Console plugin as the app reaching native', () => {
    const r = readLaunchLog('⚡️  Loading app at capacitor://localhost...\n⚡️  WebView loaded\nTo Native Cordova ->  X y 1 {}');
    expect(r.pluginCalls).toEqual([]);
  });

  it('waits for both the load and a plugin call before judging', () => {
    expect(launchSettled('⚡️  WebView loaded')).toBe(false);
    expect(launchSettled('⚡️  To Native ->  TextZoom getPreferred 1')).toBe(false);
    expect(launchSettled(GOOD)).toBe(true);
  });
});

describe('the screenshot', () => {
  const image = (fill: (x: number, y: number) => number[]) => {
    const width = 64;
    const height = 64;
    const data = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) data.set([...fill(x, y), 255], (y * width + x) * 4);
    return { width, height, channels: 4, data };
  };

  it('counts a blank WebView as one colour, under the bar', () => {
    const blank = sampledColours(image(() => [255, 255, 255]));
    expect(blank).toBe(1);
    expect(blank).toBeLessThan(MIN_COLOURS);
  });

  it('counts a drawn screen as many', () => {
    expect(sampledColours(image((x, y) => [x * 4, y * 4, 128]))).toBeGreaterThanOrEqual(MIN_COLOURS);
  });
});
