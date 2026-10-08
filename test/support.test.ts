import { describe, expect, it } from 'vitest';
import { buildFromCacheNames, supportDetails, type SupportFacts } from '../src/lib/support';
import type { Receipt } from '../src/lib/types';

const NOW = new Date('2026-10-04T12:00:00Z');

/** A receipt whose every written field carries a marker that must never be sent. */
function marked(n: number, status: Receipt['status'], demo = false): Receipt {
  return {
    id: `ID-MARK-${n}`,
    store: `STORE-MARK-${n}`,
    item: `ITEM-MARK-${n}`,
    cat: 'audio',
    amount: 98700 + n,
    purchasedOn: '2026-09-1' + n,
    windowDays: 30,
    policy: `POLICY-MARK-${n}`,
    distance: true,
    status,
    orderRef: `ORDER-MARK-${n}`,
    ...(demo ? { demo: true } : {}),
  } as Receipt;
}

const facts = (over: Partial<SupportFacts> = {}): SupportFacts => ({
  version: '0.1.0',
  build: 'a1b2c3d4e5f6',
  platform: 'web',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  receipts: [marked(1, 'active'), marked(2, 'active', true), marked(3, 'sent'), marked(4, 'returned'), marked(5, 'kept')],
  storageBytes: 48 * 1024,
  persisted: true,
  now: NOW,
  ...over,
});

describe('the details a person sends to support', () => {
  it('says which version and build, where, and how much', () => {
    const text = supportDetails(facts());
    expect(text).toContain('Quids In 0.1.0 (build a1b2c3d4e5f6) · web');
    expect(text).toContain('Device: Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    expect(text).toContain('Receipts: 5 (2 open, 1 sent back, 1 returned, 1 kept; 1 samples)');
    expect(text).toContain('Storage: 48 KB, kept by the browser');
    expect(text).toContain('Copied: 2026-10-04T12:00:00.000Z');
  });

  it('says nothing about what was bought — not a shop, item, amount, date, policy, order or id', () => {
    const text = supportDetails(facts({ error: { message: 'TypeError: x is undefined', where: 'at Detail\nat App' } }));
    for (const marker of ['MARK', '987', '2026-09-1']) expect(text).not.toContain(marker);
  });

  it('carries a render error, on one line, with where it happened cut to a few frames', () => {
    const where = Array.from({ length: 20 }, (_, i) => `    at Frame${i} (app.js:1:${i})`).join('\n');
    const text = supportDetails(facts({ error: { message: 'TypeError:\n  cannot read  "amount"', where } }));
    expect(text).toContain('Error: TypeError: cannot read "amount"');
    expect(text).toContain('Where: at Frame0 (app.js:1:0) ← ');
    expect(text).toContain('Frame5');
    expect(text).not.toContain('Frame6');
  });

  it('says what it does not know rather than guessing', () => {
    const text = supportDetails(facts({ build: null, storageBytes: null, persisted: null }));
    expect(text.split('\n')[0]).toBe('Quids In 0.1.0 · web');
    expect(text).toContain('Storage: unknown');
    expect(text).not.toContain('kept by the browser');
    expect(supportDetails(facts({ persisted: false }))).toContain('not yet kept by the browser');
  });

  it('counts a raw, damaged store without trusting it — the recovery screen reads past the loader', () => {
    const raw = [{}, { status: 'weird' }, { status: 7 }, null as unknown as { status?: unknown }, { status: 'active', demo: true }];
    expect(supportDetails(facts({ receipts: raw }))).toContain('Receipts: 5 (1 open, 0 sent back, 0 returned, 0 kept, 4 unreadable; 1 samples)');
  });
});

describe('the build, from the service worker cache name', () => {
  it('is the id of the one kept cache', () => {
    expect(buildFromCacheNames(['kept-a1b2c3d4e5f6'])).toBe('a1b2c3d4e5f6');
    expect(buildFromCacheNames(['other', 'kept-a1b2c3d4e5f6', 'workbox-x'])).toBe('a1b2c3d4e5f6');
  });

  it('is unknown with none, with a placeholder never stamped, or with two (an update waiting)', () => {
    expect(buildFromCacheNames([])).toBeNull();
    expect(buildFromCacheNames(['kept-__BUILD_ID__'])).toBeNull();
    expect(buildFromCacheNames(['kept-a1b2c3d4e5f6', 'kept-0f0f0f0f0f0f'])).toBeNull();
  });
});
