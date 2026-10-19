import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Home } from '../src/app/screens/Home';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

/**
 * The receipts list, as drawn. Two things the design audit found: rows
 * titled by the shop, so four Currys rows read the same; and a refund that
 * was late listed last, under Later, in a card style of its own.
 */
const TODAY = new Date(2026, 9, 18);
const iso = (n: number) => toISODate(addDays(TODAY, n));
const noop = () => {};
const receipt = (over: Partial<Receipt>): Receipt => ({
  id: 'r', store: 'Currys', item: 'Thing', cat: 'audio', amount: toPence(89),
  purchasedOn: iso(0), windowDays: 30, policy: 'p', distance: false, status: 'active', ...over,
});
const draw = (receipts: Receipt[]) =>
  renderToStaticMarkup(createElement(Home, {
    receipts, today: TODAY, urgentDays: 7, policyAlert: null, changedIds: new Set<string>(),
    onOpen: noop, onSwipe: noop, onKeepClosed: noop, onAdd: noop, onWatch: noop, onClearSamples: noop,
  }));
const titles = (html: string) => [...html.matchAll(/data-name="[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);
const headings = (html: string) => [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));

describe('the receipts list', () => {
  it('titles each row by its item, so four rows from one shop can be told apart', () => {
    const html = draw([
      receipt({ id: 'a', item: 'JBL Tune 770NC', purchasedOn: iso(-28) }),
      receipt({ id: 'b', item: 'Sony WH-1000XM5', purchasedOn: iso(-27) }),
      receipt({ id: 'c', item: 'Dyson V15', purchasedOn: iso(-5) }),
      receipt({ id: 'd', item: 'Le Creuset casserole', purchasedOn: iso(-4), demo: true }),
    ]);
    expect(titles(html).sort()).toEqual(['Dyson V15', 'JBL Tune 770NC', 'Le Creuset casserole', 'Sony WH-1000XM5']);
    // A sample says so once, with a tag, not with "sample ·" before its words.
    expect(html.match(/data-sample/g)).toHaveLength(1);
    expect(html).not.toMatch(/sample ·/i);
  });

  it('puts a refund that is late above every deadline, and one still awaited below them', () => {
    const html = draw([
      receipt({ id: 'later', item: 'Kettle', purchasedOn: iso(-1) }),
      receipt({ id: 'soon', item: 'Toaster', purchasedOn: iso(-27) }),
      receipt({ id: 'late', item: 'Wool coat', store: 'Zara', cat: 'clothing', distance: true, status: 'sent', purchasedOn: iso(-30), arrivedOn: iso(-28), sentOn: iso(-20) }),
      receipt({ id: 'wait', item: 'Jumper', store: 'Zara', cat: 'clothing', status: 'sent', purchasedOn: iso(-5), sentOn: iso(-2) }),
    ]);
    const h = headings(html);
    const late = h.findIndex((x) => x.startsWith('Refund late'));
    expect(late, h.join(' | ')).toBeGreaterThanOrEqual(0);
    expect(late).toBeLessThan(h.indexOf('Due soon'));
    expect(late).toBeLessThan(h.indexOf('Later'));
    expect(h.findIndex((x) => x.startsWith('Sent back'))).toBeGreaterThan(h.indexOf('Later'));
    // The late one under its heading, the awaited one under its own.
    const lateList = html.slice(html.indexOf('data-late-refunds'));
    expect(lateList.slice(0, lateList.indexOf('</ul>'))).toContain('Wool coat');
    expect(lateList.slice(0, lateList.indexOf('</ul>'))).not.toContain('Jumper');
  });
});
