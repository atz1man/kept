import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { readReceipt } from '../src/lib/backup';
import { cancelLetter, cancelledInTime, cancelOffered, sendBackBy } from '../src/lib/cancel-notice';
import { addDays, fmtDateLong, toISODate } from '../src/lib/dates';
import { COOLING_OFF_DAYS, legalRights, RETURN_AFTER_CANCEL_DAYS, SEALED_EXCEPTION } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import { refundChase, refundLetter } from '../src/lib/refund-chase';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * Cancelling an online order is TELLING the shop (reg. 32), inside fourteen
 * days of delivery (reg. 29–30); the goods then have fourteen days of their
 * own to go back (reg. 35). kept recorded only the posting, so a parcel sent
 * on day 20 after notice on day 10 lost the refund rule that covered it.
 */

const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));

/** Ordered `ago` days before TODAY, online, delivered the day after. */
const order = (ago: number, over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'ASOS', item: 'Trainers', cat: 'clothing', amount: toPence(60),
  purchasedOn: iso(-ago), arrivedOn: iso(-ago + 1), windowDays: 28, policy: 'p', distance: true, status: 'active',
  ...over,
});

describe('the notice, while the cancellation period runs', () => {
  it('is offered on an online order in hand, through the last day of the period and not after', () => {
    // Delivered `ago - 1` days ago: the period ends COOLING_OFF_DAYS after that.
    expect(cancelOffered(order(COOLING_OFF_DAYS + 1), TODAY)).toEqual({ ends: TODAY, hedged: false });
    expect(cancelOffered(order(COOLING_OFF_DAYS + 2), TODAY)).toBeNull();
  });

  it('counts from the order while nobody has said it arrived, and says the end is no earlier', () => {
    expect(cancelOffered(order(3, { arrivedOn: undefined }), TODAY)).toEqual({ ends: addDays(TODAY, COOLING_OFF_DAYS - 3), hedged: true });
  });

  it('is not offered over a counter, once gone back or kept, or once the notice has gone', () => {
    expect(cancelOffered(order(3, { distance: false }), TODAY)).toBeNull();
    expect(cancelOffered(order(3, { status: 'sent', sentOn: iso(-1) }), TODAY)).toBeNull();
    expect(cancelOffered(order(3, { status: 'kept', keptOn: iso(-1) }), TODAY)).toBeNull();
    expect(cancelOffered(order(3, { cancelledOn: iso(-1) }), TODAY)).toBeNull();
  });

  it('is the model form’s parts, in a letter’s words, naming the rule for the refund', () => {
    const letter = cancelLetter(order(3, { orderRef: 'AS-123' }));
    expect(letter.split('\n').slice(0, 5)).toEqual(['Dear ASOS,', '', 'Cancellation of order: Trainers', 'Order number: AS-123', '']);
    expect(letter).toContain(`I am cancelling my contract for the following goods: “Trainers”, £60.00, ordered on ${fmtDateLong(addDays(TODAY, -3))}, received on ${fmtDateLong(addDays(TODAY, -2))}.`);
    expect(letter).toContain('Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013');
    expect(letter).toContain('Under regulation 34, the refund is due within 14 days');
    expect(letter.endsWith('Yours faithfully,')).toBe(true);
    expect(cancelLetter(order(3, { arrivedOn: undefined }))).not.toContain('received on');
  });
});

describe('once the notice has gone', () => {
  it('has fourteen days to send it back, from the day of the notice', () => {
    expect(RETURN_AFTER_CANCEL_DAYS).toBe(14);
    expect(sendBackBy(order(5, { cancelledOn: iso(-2) }))).toEqual(addDays(TODAY, RETURN_AFTER_CANCEL_DAYS - 2));
    expect(sendBackBy(order(5))).toBeNull();
  });

  it('counts as in time up to the last day of the period, and not the day after', () => {
    const delivered = -20;
    const at = (n: number) => order(21, { arrivedOn: iso(delivered), cancelledOn: iso(delivered + n) });
    expect(cancelledInTime(at(COOLING_OFF_DAYS))).toBe(true);
    expect(cancelledInTime(at(COOLING_OFF_DAYS + 1))).toBe(false);
    expect(cancelledInTime(order(21, { distance: false, cancelledOn: iso(-10) }))).toBe(false);
  });

  it('brings the refund rule to a parcel posted after the period, when notice came inside it', () => {
    // Delivered 30 days ago, notice on day 10, posted on day 20, 14 days ago.
    const posted = order(31, { arrivedOn: iso(-30), status: 'sent', sentOn: iso(-15) });
    expect(refundChase(posted, TODAY)?.statutory).toBe(false);
    const noticed = { ...posted, cancelledOn: iso(-20) };
    expect(refundChase(noticed, TODAY)?.statutory).toBe(true);
    expect(refundLetter(noticed, TODAY)).toContain(`I cancelled the order on ${fmtDateLong(addDays(TODAY, -20))} and sent it back to you on ${fmtDateLong(addDays(TODAY, -15))}.`);
    expect(refundLetter(noticed, TODAY)).toContain('regulation 34');
    // Notice too late is no notice for this purpose.
    expect(refundChase({ ...posted, cancelledOn: iso(-15) }, TODAY)?.statutory).toBe(false);
  });
});

describe('recording the notice', () => {
  const state = (r: Receipt): AppState => ({
    version: 1, receipts: [r], updates: [], onboardingSeen: true,
    settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
    screen: 'detail', selId: r.id, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
    sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
  });
  const a = (s: AppState) => s.receipts[0];

  it('keeps the first day it went, on an online order in hand only', () => {
    const sent = reducer(state(order(3)), { type: 'cancel-sent', id: 'a' }, TODAY);
    expect(a(sent).cancelledOn).toBe(toISODate(TODAY));
    expect(a(reducer(sent, { type: 'cancel-sent', id: 'a' }, addDays(TODAY, 2))).cancelledOn).toBe(toISODate(TODAY));
    const counter = state(order(3, { distance: false }));
    expect(reducer(counter, { type: 'cancel-sent', id: 'a' }, TODAY)).toEqual(counter);
    const kept = state(order(3, { status: 'kept', keptOn: iso(0) }));
    expect(reducer(kept, { type: 'cancel-sent', id: 'a' }, TODAY)).toEqual(kept);
  });

  it('is forgotten when it turns out not to have gone', () => {
    const sent = reducer(state(order(3)), { type: 'cancel-sent', id: 'a' }, TODAY);
    expect(a(reducer(sent, { type: 'cancel-unsent', id: 'a' }, TODAY)).cancelledOn).toBeUndefined();
  });

  it('is carried by a backup on an online order, and a day that is not one is dropped', () => {
    expect(readReceipt({ ...order(3), cancelledOn: iso(-1) })?.cancelledOn).toBe(iso(-1));
    expect(readReceipt({ ...order(3), cancelledOn: '2026-02-31' })?.cancelledOn).toBeUndefined();
    expect(readReceipt({ ...order(3), distance: false, cancelledOn: iso(-1) })?.cancelledOn).toBeUndefined();
  });
});

describe('sealed toiletries and cosmetics', () => {
  it('say that opening the seal ends the right to cancel, and nothing else does', () => {
    const cooling = (cat: Receipt['cat']) => legalRights(order(3, { cat }), TODAY, true).find((r) => r.chip === 'Consumer Contracts Regs')!.body;
    expect(cooling('beauty')).toContain(SEALED_EXCEPTION);
    expect(cooling('clothing')).not.toContain(SEALED_EXCEPTION);
  });
});
