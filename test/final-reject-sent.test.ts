import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Letter } from '../src/app/components/Letter';
import { reducer, type AppState } from '../src/app/state';
import { alertKey, dueAlerts } from '../src/lib/alerts';
import { readReceipt } from '../src/lib/backup';
import { claimPack, claimPackText } from '../src/lib/claim-pack';
import { comingUp } from '../src/lib/coming-up';
import { addDays, fmtDateLong, toISODate } from '../src/lib/dates';
import { finalRejectLetter, REPLY_DAYS } from '../src/lib/fault-letter';
import { toPence } from '../src/lib/money';
import { splitReceipt } from '../src/lib/split';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * The second letter — the final right to reject, section 24(5) — could be
 * written and copied, and never marked as sent. So the app never knew when it
 * went: the claim pack, the document sent to a bank or a complaints team,
 * stopped at the first letter, and nothing asked whether the shop replied.
 */

const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));

/** A kettle bought `ago` days back, its fault letter sent ten days after. */
const kettle = (ago = 90, over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: toPence(40),
  purchasedOn: iso(-ago), windowDays: 30, policy: 'p', distance: false, status: 'kept', keptOn: iso(-ago + 5),
  faultClaim: { sentOn: iso(-ago + 10), what: 'It trips the fuse' },
  ...over,
});
const rejected = (finalOn: number, what?: string, ago = 90): Receipt => {
  const r = kettle(ago);
  return { ...r, faultClaim: { ...r.faultClaim!, finalReject: { sentOn: iso(finalOn), ...(what ? { what } : {}) } } };
};

const state = (r: Receipt, alertsSent: string[] = []): AppState => ({
  version: 1, receipts: [r], updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsLate: {}, reviewAsked: null, alertsSent,
  screen: 'detail', selId: r.id, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
});
const a = (s: AppState) => s.receipts[0];

describe('recording that the final rejection went', () => {
  it('records today and the words, tidied, beside the first letter, which is untouched', () => {
    const s = reducer(state(kettle()), { type: 'final-reject-sent', id: 'a', what: '  Still  trips it ' }, TODAY);
    expect(a(s).faultClaim).toEqual({ sentOn: iso(-80), what: 'It trips the fuse', finalReject: { sentOn: iso(0), what: 'Still trips it' } });
    expect(a(reducer(state(kettle()), { type: 'final-reject-sent', id: 'a', what: ' ' }, TODAY)).faultClaim?.finalReject).toEqual({ sentOn: iso(0) });
  });

  it('only after a first letter, and only on a receipt still with its owner', () => {
    const none = state(kettle(90, { faultClaim: undefined }));
    expect(reducer(none, { type: 'final-reject-sent', id: 'a', what: 'x' }, TODAY)).toBe(none);
    const back = state(kettle(90, { status: 'returned', returnedOn: iso(-1) }));
    expect(a(reducer(back, { type: 'final-reject-sent', id: 'a', what: 'x' }, TODAY)).faultClaim?.finalReject).toBeUndefined();
    expect(a(reducer(state(kettle(90, { status: 'active' })), { type: 'final-reject-sent', id: 'a', what: '' }, TODAY)).faultClaim?.finalReject).toEqual({ sentOn: iso(0) });
  });

  it('asks again whether the shop replied — now about this letter', () => {
    const s = reducer(state(kettle(), [alertKey('a', 'fault')]), { type: 'final-reject-sent', id: 'a', what: '' }, TODAY);
    expect(s.alertsSent).toEqual([]);
  });

  it('is taken back without touching the first letter, and does not re-ask about a first letter long due', () => {
    const s = reducer(state(rejected(-3, 'Still trips it')), { type: 'final-reject-unsent', id: 'a' }, TODAY);
    expect(a(s).faultClaim).toEqual({ sentOn: iso(-80), what: 'It trips the fuse' });
    expect(s.alertsSent).toEqual([alertKey('a', 'fault')]);
    // A first letter whose own fortnight is still running is asked about in time.
    const fresh = { ...kettle(), faultClaim: { sentOn: iso(-3), finalReject: { sentOn: iso(-1) } } };
    expect(reducer(state(fresh), { type: 'final-reject-unsent', id: 'a' }, TODAY).alertsSent).toEqual([]);
  });

  it('goes with the first letter when that is taken back', () => {
    expect(a(reducer(state(rejected(-3)), { type: 'fault-unsent', id: 'a' }, TODAY)).faultClaim).toBeUndefined();
  });

  it('does not travel to the part of a split', () => {
    const r = { ...rejected(-3), lines: [{ item: 'Kettle', pence: 2000 }, { item: 'Toaster', pence: 2000 }] };
    const { part } = splitReceipt(r, 'Toaster', 2000, 'b');
    expect(part.faultClaim).toBeUndefined();
  });
});

describe('a sent final rejection, in a backup', () => {
  it('is carried with its words', () => {
    expect(readReceipt(rejected(-3, 'Still trips it'))?.faultClaim).toEqual({
      sentOn: iso(-80), what: 'It trips the fuse', finalReject: { sentOn: iso(-3), what: 'Still trips it' },
    });
  });

  it('is dropped on a day that does not exist, and the first letter is kept', () => {
    for (const sentOn of ['2026-02-30', 'yesterday', 20260825, null, undefined]) {
      const raw = { ...kettle(), faultClaim: { sentOn: iso(-80), finalReject: { sentOn } } };
      expect(readReceipt(raw, true)?.faultClaim, String(sentOn)).toEqual({ sentOn: iso(-80) });
    }
    expect(readReceipt({ ...kettle(), faultClaim: { sentOn: iso(-80), finalReject: 'yes' } }, true)?.faultClaim).toEqual({ sentOn: iso(-80) });
    // And a bad FIRST letter takes the second with it: there is nothing for it to follow.
    expect(readReceipt({ ...kettle(), faultClaim: { sentOn: 'nope', finalReject: { sentOn: iso(-3) } } }, true)?.faultClaim).toBeUndefined();
  });

  it('trims the words from a file from outside, and leaves its own alone', () => {
    const long = 'x'.repeat(5000);
    const raw = { ...kettle(), faultClaim: { sentOn: iso(-80), finalReject: { sentOn: iso(-3), what: long } } };
    expect(readReceipt(raw, true)!.faultClaim!.finalReject!.what!.length).toBe(2000);
    expect(readReceipt(raw)!.faultClaim!.finalReject!.what).toBe(long);
    const notWords = { ...kettle(), faultClaim: { sentOn: iso(-80), finalReject: { sentOn: iso(-3), what: 7 } } };
    expect(readReceipt(notWords, true)!.faultClaim!.finalReject).toEqual({ sentOn: iso(-3) });
  });
});

describe('the final rejection, in the claim pack', () => {
  it('is on the timeline as sent, with the reply it asked for by', () => {
    const t = claimPack(rejected(-3, 'Still trips it'), TODAY).timeline;
    const sent = t.find((e) => e.label === 'Final rejection sent')!;
    expect([sent.kind, toISODate(sent.on), sent.detail]).toEqual(['happened', iso(-3), 'Still trips it']);
    const replies = t.filter((e) => e.label === 'Reply asked for by');
    expect(replies.map((e) => [toISODate(e.on), e.detail])).toEqual([
      [iso(-80 + REPLY_DAYS), `The fault letter asked for one within ${REPLY_DAYS} days`],
      [iso(-3 + REPLY_DAYS), `The final rejection letter asked for one within ${REPLY_DAYS} days`],
    ]);
    expect(replies[1].passed).toBe(false);
  });

  it('says it was sent, and nothing about one never recorded', () => {
    const said = `A letter exercising the final right to reject (Consumer Rights Act 2015, s.24(5)) was sent to the shop on ${fmtDateLong(addDays(TODAY, -3))}.`;
    expect(claimPack(rejected(-3), TODAY).standing).toContain(said);
    const plain = claimPack(kettle(), TODAY);
    expect(plain.standing.join(' ')).not.toMatch(/final right to reject/);
    expect(plain.timeline.map((e) => e.label)).not.toContain('Final rejection sent');
    expect(plain.letters.map((l) => l.title)).toEqual(['Fault letter']);
  });

  it('reproduces the letter as drafted on the day it went, after the first', () => {
    // Bought 200 days ago; the final rejection went on day 100, inside the six
    // months in which the refund may not be cut for use (s.24(10)). Today is
    // past them, and today's draft would no longer say so — the pack must.
    const r = rejected(-100, 'Still trips it', 200);
    expect(finalRejectLetter(r, TODAY, 'Still trips it')).not.toContain('24(10)');
    const letters = claimPack(r, TODAY).letters;
    expect(letters.map((l) => [l.title, toISODate(l.sentOn)])).toEqual([['Fault letter', iso(-190)], ['Final rejection letter', iso(-100)]]);
    expect(letters[1].text).toBe(finalRejectLetter(r, addDays(TODAY, -100), 'Still trips it'));
    expect(letters[1].text).toContain('section 24(10)');
    expect(letters[1].text).toContain('has not been put right. Still trips it.');
    expect(claimPackText(claimPack(r, TODAY))).toContain(`Final rejection letter, sent ${fmtDateLong(addDays(TODAY, -100))}`);
  });
});

describe('the reply to the final rejection, coming up and asked about', () => {
  it('replaces the first letter’s reply on the list', () => {
    const list = comingUp([rejected(-3)], TODAY).filter((c) => c.kind === 'fault');
    expect(list.map((c) => [toISODate(c.date), c.what])).toEqual([[iso(-3 + REPLY_DAYS), 'The reply your final rejection letter asked for is due']]);
  });

  it('is asked about on the day the final letter asked for a reply by, and not before', () => {
    const due = (r: Receipt) => dueAlerts([r], TODAY, 7, new Set()).filter((x) => x.rung === 'fault');
    expect(due(rejected(-(REPLY_DAYS - 1)))).toHaveLength(0);
    const [alert] = due(rejected(-REPLY_DAYS));
    expect(alert.body).toContain(`you wrote about the fault on`);
    expect(alert.body).toContain(`asked for a reply within ${REPLY_DAYS} days`);
  });
});

describe('two letters on one screen, told apart', () => {
  const html = (name?: string) => renderToStaticMarkup(createElement(Letter, { letter: 'Dear Currys,', title: 't', receipt: kettle(), ...(name ? { name } : {}) }));

  it('names the first letter as it always was — the sweeps find it by these words', () => {
    expect(html()).toContain('aria-label="The letter"');
    expect(html()).toContain('>Copy the letter<');
  });

  it('names the final rejection for what it is', () => {
    const h = html('final rejection letter');
    expect(h).toContain('aria-label="The final rejection letter"');
    expect(h).toContain('>Copy the final rejection letter<');
    expect(h).not.toContain('"The letter"');
  });
});
