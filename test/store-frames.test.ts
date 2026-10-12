import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS script, run as `npm run store:frames`
import { CAPTIONS, SIZE } from '../scripts/store-frames.mjs';
import { STORE_COUNT } from '../src/lib/stores';
import { COOLING_OFF_DAYS, REJECT_DAYS, firstToClose, firstToCloseLine } from '../src/lib/legal';
import { addSubtitle } from '../src/lib/receipt-scan';
import type { Receipt } from '../src/lib/types';

/**
 * The App Store frames' captions, held to the app they sell.
 *
 * A caption is the largest type anyone sees before installing, and it is a
 * claim: a retailer count, two legal periods, a privacy promise. The listing
 * beside it is checked figure by figure (test/store-listing.test.ts); these
 * are the same kind of text, in a bigger font, so they are checked the same
 * way — against the constant or the sentence in the app that makes the same
 * claim, not against anyone's memory of it.
 */
const ROOT = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const caption = (name: string) => {
  const c = (CAPTIONS as string[][]).find(([n]) => n === name);
  if (!c) throw new Error(`no caption for ${name}`);
  return c.slice(1).join(' ');
};
const all = (CAPTIONS as string[][]).map((c) => c.slice(1).join(' ')).join('\n');

describe('the frames', () => {
  it('finds the captions it is meant to be checking', () => {
    // A check over an empty table passes silently.
    expect(CAPTIONS).toHaveLength(4);
    for (const c of CAPTIONS as string[][]) expect(c).toHaveLength(4);
  });

  it('frame exactly the shots store:screenshots writes, in its order', () => {
    const src = read('scripts', 'store-screenshots.mjs');
    const shot = [...src.matchAll(/shoot\('([a-z-]+)'\)/g)].map((m) => m[1]);
    const scan = [...src.matchAll(/\}-([a-z-]+)\.png`/g)].map((m) => m[1]);
    const written = [...shot, ...scan].map((n, i) => `${String(i + 1).padStart(2, '0')}-${n}`);
    expect(written.length).toBe(4);
    expect((CAPTIONS as string[][]).map(([n]) => n)).toEqual(written);
  });

  it('are 1290 × 2796, the size the raw shots are taken at', () => {
    expect(SIZE).toEqual({ width: 1290, height: 2796 });
    const src = read('scripts', 'store-screenshots.mjs');
    const vw = Number(src.match(/VIEWPORT = \{ width: (\d+), height: (\d+) \}/)?.[1]);
    const vh = Number(src.match(/VIEWPORT = \{ width: (\d+), height: (\d+) \}/)?.[2]);
    const scale = Number(src.match(/const SCALE = (\d+);/)?.[1]);
    expect({ width: vw * scale, height: vh * scale }).toEqual(SIZE);
  });

  it('take every colour from the tokens', () => {
    expect(read('scripts', 'store-frames.mjs')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('what the captions claim', () => {
  it('counts the shops the table actually has', () => {
    expect(caption('01-deadlines')).toContain(`${STORE_COUNT} UK retailers`);
    const counts = [...all.matchAll(/\b(\d+)\s+UK\b/g)].map((m) => Number(m[1]));
    expect(counts).toEqual([STORE_COUNT]);
  });

  it('states the two legal periods the app counts, and no other', () => {
    const rights = caption('02-shop-clock-and-your-rights');
    expect(rights).toContain(`${REJECT_DAYS} days to reject a fault`);
    expect(rights).toContain(`${COOLING_OFF_DAYS} days to cancel online`);
    const days = [...all.matchAll(/\b(\d+)\s+days?\b/g)].map((m) => Number(m[1]));
    expect(days.filter((d) => d !== REJECT_DAYS && d !== COOLING_OFF_DAYS)).toEqual([]);
  });

  it('says it shows which closes first only while the receipt does', () => {
    // IKEA's 365 days: the first clock to go is the 30-day right to reject.
    const r: Receipt = {
      id: 'k', store: 'IKEA', item: 'Sofa', cat: 'furniture', amount: 49900, purchasedOn: '2026-09-20',
      windowDays: 365, policy: 'IKEA · 365 days', distance: false, status: 'active',
    };
    const today = new Date(2026, 8, 28);
    const first = firstToClose(r, today, new Date(2027, 8, 20));
    expect(first).not.toBeNull();
    expect(firstToCloseLine(first!)).toMatch(/^(Likely to close first|Closes first)/);
    expect(caption('02-shop-clock-and-your-rights')).toContain('which closes first');
  });

  it('claims no more of a paste than the add screen does', () => {
    expect(caption('03-paste-an-order-email')).toMatch(/Shop, total and date/);
    expect(addSubtitle('paste')).toContain('the store, total and date');
    // The listing makes the same "asks when it is not sure" promise, and is held to it.
    expect(read('store', 'listing.json')).toMatch(/asks rather than guesses when it is not sure/);
  });

  it('promises the privacy the app itself promises, in its own words', () => {
    const scan = caption('04-scan-a-till-receipt');
    const privacy = read('src', 'privacy', 'Privacy.tsx');
    const add = read('src', 'app', 'screens', 'Add.tsx');
    // "No account" and "nothing leaves it": the privacy page's own lede.
    expect(scan).toContain('No account');
    expect(privacy).toMatch(/No account, nothing uploaded/);
    expect(privacy).toMatch(/There is no account, no sign-in and no server that receives your receipts/);
    // "Never uploaded" and "Read on your phone": the scan row's own sentence.
    expect(scan).toContain('Never uploaded');
    expect(scan).toContain('Read on your phone');
    expect(add).toContain('Read on this phone — the photo is never uploaded.');
    // And the header above a scanned read now says the same, not "paste".
    expect(addSubtitle('photo')).toContain('Read from your photo on this phone');
  });
});
