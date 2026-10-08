import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import {
  celebrationLeft,
  isMoneyBack,
  moneyBackCount,
  readReviewAsked,
  REVIEW_GAP_DAYS,
  shouldAskForReview,
  WINS_BEFORE_ASKING,
  type ReviewMoment,
} from '../src/lib/review-prompt';
import { DEFAULT_SETTINGS, exportBackup, freshState, hydrate } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/**
 * When the iPhone app asks iOS for its rating prompt: each rule at the edge
 * where it changes its mind. Apple caps how often its dialog appears, but
 * not how often it is ASKED, and an app that asks at the wrong moment, or
 * every refund, is the one people rate down for asking.
 */

const TODAY = new Date(2026, 9, 8);

const receipt = (id: string, over: Partial<Receipt> = {}): Receipt => ({
  id, store: 'Argos', item: `Thing ${id}`, cat: 'kitchen', amount: toPence(24.99),
  purchasedOn: '2026-09-20', windowDays: 30, policy: '30 days', distance: false, status: 'active',
  ...over,
});
const back = (id: string, over: Partial<Receipt> = {}) => receipt(id, { status: 'returned', returnedOn: toISODate(TODAY), ...over });

/** Two real refunds, the second just celebrated: the moment that asks, unless something says otherwise. */
const moment = (over: Partial<ReviewMoment> = {}): ReviewMoment => {
  const receipts = over.receipts ?? [back('first'), back('second'), receipt('open')];
  return {
    native: true,
    embedded: false,
    won: receipts.find((r) => r.id === 'second'),
    receipts,
    version: '1.1.0',
    today: TODAY,
    last: null,
    ...over,
  };
};

const daysAgo = (n: number) => toISODate(addDays(TODAY, -n));

describe('what counts as money back', () => {
  it('is a returned receipt of the person’s own, refunded with something', () => {
    expect(isMoneyBack(back('a'))).toBe(true);
    expect(isMoneyBack(back('a', { refunded: toPence(5) }))).toBe(true);
  });

  it('is not a sample, a swap, a refund of nothing, or a receipt still open, posted or kept', () => {
    expect(isMoneyBack(back('a', { demo: true }))).toBe(false);
    expect(isMoneyBack(back('a', { exchanged: true }))).toBe(false);
    expect(isMoneyBack(back('a', { refunded: 0 }))).toBe(false);
    for (const status of ['active', 'sent', 'kept'] as const) expect(isMoneyBack(receipt('a', { status }))).toBe(false);
  });

  it('is counted from the library, samples left out', () => {
    expect(moneyBackCount([back('a'), back('b', { demo: true }), back('c'), receipt('d')])).toBe(2);
    expect(moneyBackCount([])).toBe(0);
  });
});

describe('whether to ask', () => {
  it('asks on the second real money-back moment, never asked before', () => {
    expect(WINS_BEFORE_ASKING).toBe(2);
    expect(shouldAskForReview(moment())).toBe(true);
  });

  it('does not ask on the first', () => {
    const receipts = [back('second'), receipt('open')];
    expect(shouldAskForReview(moment({ receipts, won: receipts[0] }))).toBe(false);
  });

  it('asks on a later one too, when the first chance was missed', () => {
    const receipts = [back('a'), back('b'), back('c'), back('second')];
    expect(shouldAskForReview(moment({ receipts, won: receipts[3] }))).toBe(true);
  });

  it('does not count samples towards the second', () => {
    // One real refund beside three returned samples is still a first.
    const receipts = [back('s1', { demo: true }), back('s2', { demo: true }), back('s3', { demo: true }), back('second')];
    expect(shouldAskForReview(moment({ receipts, won: receipts[3] }))).toBe(false);
  });

  it('never asks about a sample’s refund, however many real ones there are', () => {
    const receipts = [back('a'), back('b'), back('sample', { demo: true })];
    expect(shouldAskForReview(moment({ receipts, won: receipts[2] }))).toBe(false);
  });

  it('never asks about a return that has been undone, or a receipt that has gone', () => {
    const receipts = [back('first'), back('third'), receipt('second')];
    expect(shouldAskForReview(moment({ receipts, won: receipts[2] }))).toBe(false);
    expect(shouldAskForReview(moment({ won: undefined }))).toBe(false);
  });

  it('never asks about a refund of nothing', () => {
    const receipts = [back('first'), back('third'), back('second', { refunded: 0 })];
    expect(shouldAskForReview(moment({ receipts, won: receipts[2] }))).toBe(false);
  });

  it('only in the iPhone app', () => {
    expect(shouldAskForReview(moment({ native: false }))).toBe(false);
  });

  it('never in the landing page’s demo, even on a phone', () => {
    expect(shouldAskForReview(moment({ embedded: true }))).toBe(false);
  });

  it('asks once per version: the same version never asks again, however long it has been', () => {
    expect(shouldAskForReview(moment({ last: { on: daysAgo(0), version: '1.1.0' } }))).toBe(false);
    expect(shouldAskForReview(moment({ last: { on: daysAgo(400), version: '1.1.0' } }))).toBe(false);
  });

  it('waits 120 days after the last ask, even across a new version', () => {
    expect(REVIEW_GAP_DAYS).toBe(120);
    expect(shouldAskForReview(moment({ last: { on: daysAgo(119), version: '1.0.0' } }))).toBe(false);
    expect(shouldAskForReview(moment({ last: { on: daysAgo(120), version: '1.0.0' } }))).toBe(true);
    expect(shouldAskForReview(moment({ last: { on: daysAgo(121), version: '1.0.0' } }))).toBe(true);
  });

  it('counts the gap in UK calendar days, across the clocks going back', () => {
    // 120 days back from 1 February is 4 October, and the clocks went back
    // between the two: whole days, not 24-hour blocks.
    const today = new Date(2027, 1, 1);
    const on = toISODate(addDays(today, -120));
    expect(shouldAskForReview(moment({ today, last: { on, version: '1.0.0' } }))).toBe(true);
    expect(shouldAskForReview(moment({ today, last: { on: toISODate(addDays(today, -119)), version: '1.0.0' } }))).toBe(false);
  });

  it('does not ask when the last ask is dated after today', () => {
    // A clock set wrong once, and put right: not a reason to ask early.
    expect(shouldAskForReview(moment({ last: { on: toISODate(addDays(TODAY, 30)), version: '1.0.0' } }))).toBe(false);
  });
});

describe('which celebration was just left', () => {
  it('holds the receipt being celebrated, and leaves nothing while it shows', () => {
    expect(celebrationLeft(null, 'celebrate', 'r1')).toEqual({ held: 'r1', left: null });
    // Still showing, after a corrected refund re-renders it.
    expect(celebrationLeft('r1', 'celebrate', 'r1')).toEqual({ held: 'r1', left: null });
  });

  it('hands it back on any other screen, once', () => {
    for (const screen of ['home', 'detail', 'settings', 'watch', 'add'] as const) {
      expect(celebrationLeft('r1', screen, 'r1')).toEqual({ held: null, left: 'r1' });
    }
    const left = celebrationLeft('r1', 'home', 'r1');
    expect(celebrationLeft(left.held, 'settings', 'r1')).toEqual({ held: null, left: null });
  });

  it('leaves nothing where nothing was celebrated', () => {
    expect(celebrationLeft(null, 'home', null)).toEqual({ held: null, left: null });
    expect(celebrationLeft(null, 'detail', 'r1')).toEqual({ held: null, left: null });
  });
});

describe('the record of the last ask', () => {
  it('reads one that was written', () => {
    expect(readReviewAsked({ on: '2026-10-08', version: '1.1.0' })).toEqual({ on: '2026-10-08', version: '1.1.0' });
  });

  it('reads anything else as never asked', () => {
    for (const raw of [
      undefined, null, 'x', 3, [], {},
      { on: '2026-10-08' },
      { version: '1.1.0' },
      { on: '8 October 2026', version: '1.1.0' },
      { on: '2026-10-8', version: '1.1.0' },
      { on: '2026-02-30', version: '1.1.0' },
      { on: '2026-13-01', version: '1.1.0' },
      // A real day, but no day this was written on, and one that would stop
      // the app ever asking again.
      { on: '10000-01-01', version: '1.1.0' },
      { on: 20261008, version: '1.1.0' },
      { on: '2026-10-08', version: '' },
      { on: '2026-10-08', version: '   ' },
      { on: '2026-10-08', version: 1 },
    ]) {
      expect(readReviewAsked(raw), JSON.stringify(raw)).toBeNull();
    }
  });

  it('keeps nothing but the two fields', () => {
    expect(readReviewAsked({ on: '2026-10-08', version: '1.1.0', extra: 'x' })).toEqual({ on: '2026-10-08', version: '1.1.0' });
  });

  it('starts as never asked, and survives a relaunch', () => {
    expect(freshState(TODAY).reviewAsked).toBeNull();
    const stored = JSON.parse(JSON.stringify({ ...freshState(TODAY), reviewAsked: { on: '2026-06-01', version: '1.0.0' } }));
    expect(hydrate(stored, TODAY).reviewAsked).toEqual({ on: '2026-06-01', version: '1.0.0' });
    // A library from before the record existed has never asked.
    const { reviewAsked: _gone, ...older } = stored;
    expect(hydrate(older, TODAY).reviewAsked).toBeNull();
    expect(hydrate({ ...stored, reviewAsked: { on: 'soon', version: '1.0.0' } }, TODAY).reviewAsked).toBeNull();
  });

  it('is not in a backup: it is about what this phone asked, not the person’s purchases', () => {
    const state = { ...freshState(TODAY), reviewAsked: { on: '2026-06-01', version: '1.0.0' } };
    const file = exportBackup(state);
    expect(JSON.parse(file)).not.toHaveProperty('reviewAsked');
    expect(file).not.toContain('2026-06-01');
  });
});

describe('the reducer', () => {
  const base = (over: Partial<AppState> = {}): AppState => ({
    version: 1, receipts: [back('a')], updates: [], onboardingSeen: true,
    settings: { ...DEFAULT_SETTINGS }, alertsLate: {}, reviewAsked: null, alertsSent: [],
    screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
    sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
    ...over,
  });
  const asked = { on: '2026-10-08', version: '1.1.0' };

  it('records an ask, replacing the last one', () => {
    expect(reducer(base(), { type: 'review-asked', asked }, TODAY).reviewAsked).toEqual(asked);
    const later = { on: '2027-02-05', version: '1.2.0' };
    expect(reducer(base({ reviewAsked: asked }), { type: 'review-asked', asked: later }, TODAY).reviewAsked).toEqual(later);
  });

  it('keeps it through Erase everything, so erasing is not a way to be asked sooner', () => {
    expect(reducer(base({ reviewAsked: asked }), { type: 'wipe' }, TODAY).reviewAsked).toEqual(asked);
  });

  it('takes another tab’s', () => {
    const theirs = { ...freshState(TODAY), reviewAsked: asked };
    expect(reducer(base(), { type: 'sync', state: theirs }, TODAY).reviewAsked).toEqual(asked);
  });
});
