import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeadlineAlert } from '../src/lib/alerts';

/*
 * Who may be shown a notification, and how many at once.
 *
 * `deliver` is three guards and a loop, and the guards were the untested half.
 * The smoke run exercises it with permission granted, in a top-level page —
 * the one case where every guard passes — so inverting any of them changed
 * nothing anywhere. Found by mutating the file: eight survivors, all of them
 * here.
 *
 * The frame check is the one that matters most. The landing page embeds THIS
 * BUILD in an iframe as its live demo, so a `deliver` that did not refuse
 * there would raise system notifications about five demo receipts at somebody
 * reading the marketing page — the same class of defect as the demo writing
 * to the visitor's real storage, which `embedded` already exists to prevent.
 */

const shown: { title: string; tag?: string }[] = [];

/** A browser: a Notification constructor, and a window that can be framed. */
function browser({ permission = 'granted', framed = false, throws = false } = {}) {
  const win: Record<string, unknown> = {};
  win.self = win;
  // A frame's `top` is a different object; a CROSS-ORIGIN one throws on the
  // comparison, which `isEmbedded` reads as the answer rather than an error.
  win.top = framed ? {} : win;
  if (throws) {
    Object.defineProperty(win, 'top', {
      get() {
        throw new Error('cross-origin');
      },
    });
  }
  (globalThis as Record<string, unknown>).window = win;
  // `navigator` is left alone: Node has one, it has no `serviceWorker`, and
  // `deliver` reaches for that optionally — so the constructor path is the one
  // under test here, which is also the fallback on a page with no worker.
  (globalThis as Record<string, unknown>).Notification = class {
    static permission = permission;
    constructor(title: string, opts?: { tag?: string }) {
      shown.push({ title, tag: opts?.tag });
    }
  };
}

const alert = (n: number): DeadlineAlert => ({
  key: `r${n}:today`,
  receiptId: `r${n}`,
  rung: 'today',
  title: `Today is the last day (${n})`,
  body: 'Currys · Headphones',
});

beforeEach(() => {
  shown.length = 0;
  vi.resetModules();
});

afterEach(() => {
  for (const key of ['window', 'Notification']) {
    delete (globalThis as Record<string, unknown>)[key];
  }
});

describe('who may be shown one', () => {
  it('shows nothing inside the landing page’s demo frame', async () => {
    browser({ framed: true });
    const { deliver } = await import('../src/app/notify');
    expect(await deliver([alert(1)])).toEqual([]);
    expect(shown).toEqual([]);
  });

  it('treats a cross-origin frame that throws as a frame, not as a top window', async () => {
    // The catch is the answer, not a failure: only a framed window can throw
    // on `window.self !== window.top`, so throwing IS being embedded.
    browser({ throws: true });
    const { deliver } = await import('../src/app/notify');
    expect(await deliver([alert(1)])).toEqual([]);
    expect(shown).toEqual([]);
  });

  it('shows nothing when permission was never granted', async () => {
    for (const permission of ['default', 'denied']) {
      shown.length = 0;
      vi.resetModules();
      browser({ permission });
      const { deliver } = await import('../src/app/notify');
      expect(await deliver([alert(1)]), permission).toEqual([]);
      expect(shown, permission).toEqual([]);
    }
  });

  it('shows them in a granted, unframed page, which is the whole point', async () => {
    // The guard rail on the three above: refusing everybody would satisfy them
    // all and deliver nothing, ever.
    browser();
    const { deliver } = await import('../src/app/notify');
    expect(await deliver([alert(1)])).toHaveLength(1);
    expect(shown).toEqual([{ title: 'Today is the last day (1)', tag: 'r1:today' }]);
  });
});

describe('how many at once', () => {
  it('stops well short of the whole backlog', async () => {
    /*
     * The number is our judgement — an app that stacks up notifications gets
     * muted — so no test asserts it. What is asserted is that there IS a cap
     * and that it bites: ten alerts must not become ten banners.
     */
    browser();
    const { deliver } = await import('../src/app/notify');
    const delivered = await deliver(Array.from({ length: 10 }, (_, i) => alert(i)));
    expect(delivered.length).toBeLessThan(10);
    expect(delivered.length).toBeGreaterThan(0);
    expect(shown).toHaveLength(delivered.length);
  });

  it('leaves the rest unrecorded, so they come up again rather than vanishing', async () => {
    /*
     * What `deliver` RETURNS is what the caller records in `alertsSent`, and
     * `planAlerts` drops anything already said. Returning more than was shown
     * would silence an alert nobody ever saw.
     */
    browser();
    const { deliver } = await import('../src/app/notify');
    const alerts = Array.from({ length: 10 }, (_, i) => alert(i));
    const delivered = await deliver(alerts);
    expect(delivered.map((a) => a.key)).toEqual(shown.map((s) => s.tag));
  });

  it('keeps the oldest, not a random handful', async () => {
    // The batch is the FRONT of the list, and the list arrives most urgent
    // first — so a cap that took the tail would drop today's deadline and
    // keep next week's.
    browser();
    const { deliver } = await import('../src/app/notify');
    const delivered = await deliver(Array.from({ length: 10 }, (_, i) => alert(i)));
    expect(delivered[0].key).toBe('r0:today');
  });

  it('says nothing at all when there is nothing to say', async () => {
    browser();
    const { deliver } = await import('../src/app/notify');
    expect(await deliver([])).toEqual([]);
    expect(shown).toEqual([]);
  });
});

describe('asking from inside the demo frame', () => {
  it('does not raise a permission prompt on the marketing page', async () => {
    // Prompts are blocked in frames anyway, and the demo has no business
    // asking for one.
    browser({ permission: 'default', framed: true });
    let asked = 0;
    (
      (globalThis as Record<string, unknown>).Notification as { requestPermission?: unknown }
    ).requestPermission = async () => {
      asked += 1;
      return 'granted';
    };
    const { requestNotifyPermission } = await import('../src/app/notify');
    expect(await requestNotifyPermission()).toBe('default');
    expect(asked).toBe(0);
  });
});
