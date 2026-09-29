import { describe, expect, it } from 'vitest';
import { openingScreen, reducer, type AppState } from '../src/app/state';
import { addDays, toISODate } from '../src/lib/dates';
import { ONBOARDING_STEPS } from '../src/app/screens/Onboarding';
import { toPence } from '../src/lib/money';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);

const receipt = (id: string): Receipt => ({
  id, store: 'Argos', item: 'Mixer', cat: 'kitchen', amount: toPence(64.99),
  purchasedOn: '2026-08-07', windowDays: 30, policy: 'p', distance: false, status: 'active',
});

const base = (over: Partial<AppState> = {}): AppState => ({
  version: 1, receipts: [receipt('a'), receipt('b')], updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
  screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: null,
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null,
  ...over,
});

describe('opening a receipt', () => {
  it('opens one that is held', () => {
    const next = reducer(base(), { type: 'open', id: 'b' }, TODAY);
    expect(next.screen).toBe('detail');
    expect(next.selId).toBe('b');
  });

  /*
   * Reachable only from a tapped notification, which is why it did not matter
   * before there was one. Every caller inside the app passes an id off a row
   * that is on screen; an alert lodged with iOS can be tapped days later, after
   * the receipt has been returned, deleted or erased.
   *
   * App.tsx renders the detail screen as `screen === 'detail' && selected`, so
   * a receipt that is gone is not an error — it is a blank page under the tab
   * bar, arrived at from a lock screen with no way to tell what went wrong.
   */
  it('falls back to the list when the receipt is gone', () => {
    const next = reducer(base(), { type: 'open', id: 'vanished' }, TODAY);
    expect(next.screen).toBe('home');
    expect(next.selId).toBeNull();
  });

  it('does not strand an undo offer either way', () => {
    const held = reducer(base({ justDeleted: null }), { type: 'open', id: 'a' }, TODAY);
    const gone = reducer(base({ justDeleted: null }), { type: 'open', id: 'nope' }, TODAY);
    expect(held.justDeleted).toBeNull();
    expect(gone.justDeleted).toBeNull();
  });
});

describe('sharing a win', () => {
  // It reported success either way, so a refused clipboard rendered as
  // "Copied — paste it anywhere ✓" and the person found out by pasting
  // nothing into a message to a friend.
  it('says it copied when it did', () => {
    expect(reducer(base(), { type: 'shared', outcome: 'copied' }, TODAY).shared).toBe('copied');
  });

  it('says it did not when it did not', () => {
    expect(reducer(base(), { type: 'shared', outcome: 'failed' }, TODAY).shared).toBe('failed');
  });

  it('says it shared when the share sheet finished', () => {
    expect(reducer(base(), { type: 'shared', outcome: 'shared' }, TODAY).shared).toBe('shared');
  });

  it('starts having said nothing', () => {
    expect(base().shared).toBe('no');
  });
});

describe('undoing a delete', () => {
  it('puts the receipt back', () => {
    const deleted = reducer(base(), { type: 'delete', id: 'a' }, TODAY);
    expect(deleted.receipts.map((r) => r.id)).toEqual(['b']);
    const undone = reducer(deleted, { type: 'undo-delete' }, TODAY);
    expect(undone.receipts.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(undone.justDeleted).toBeNull();
  });

  it('does not duplicate one another tab already restored', () => {
    // Reachable when a second tab writes state that still contains the receipt
    // before the undo is tapped. Two rows for one receipt counts the money
    // twice, which is the one thing this app must not do.
    const deleted = reducer(base(), { type: 'delete', id: 'a' }, TODAY);
    const synced = reducer(deleted, { type: 'sync', state: {
      version: 1, receipts: [receipt('a'), receipt('b')], updates: [],
      onboardingSeen: true, settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
    } }, TODAY);
    const undone = reducer(synced, { type: 'undo-delete' }, TODAY);
    expect(undone.receipts.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(undone.justDeleted).toBeNull();
  });

  it('does nothing when there is nothing to undo', () => {
    const s = base();
    expect(reducer(s, { type: 'undo-delete' }, TODAY)).toBe(s);
  });
});

describe('adopting another tab’s state', () => {
  it('keeps the screen you are on', () => {
    const s = base({ screen: 'settings' });
    const synced = reducer(s, { type: 'sync', state: {
      version: 1, receipts: [receipt('a')], updates: [], onboardingSeen: true,
      settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
    } }, TODAY);
    expect(synced.screen).toBe('settings');
    expect(synced.receipts.map((r) => r.id)).toEqual(['a']);
  });

  it('leaves an open receipt open when it still exists', () => {
    const s = base({ screen: 'detail', selId: 'a' });
    const synced = reducer(s, { type: 'sync', state: {
      version: 1, receipts: [receipt('a'), receipt('b')], updates: [], onboardingSeen: true,
      settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
    } }, TODAY);
    expect(synced).toMatchObject({ screen: 'detail', selId: 'a' });
  });

  it('falls back to the list when the open receipt was deleted elsewhere', () => {
    // Otherwise the detail screen renders nothing at all.
    for (const screen of ['detail', 'edit'] as const) {
      const s = base({ screen, selId: 'a' });
      const synced = reducer(s, { type: 'sync', state: {
        version: 1, receipts: [receipt('b')], updates: [], onboardingSeen: true,
        settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
      } }, TODAY);
      expect(synced).toMatchObject({ screen: 'home', selId: null });
    }
  });
});

describe('tapping a price', () => {
  // It used to dispatch the plan change directly, so a tap on "£39.99
  // lifetime" flipped the app to pro with no card taken and nothing said.
  it('opens the notice and leaves the plan alone', () => {
    const s = reducer(base(), { type: 'upgrade-ask', period: 'lifetime' }, TODAY);
    expect(s.upgrading).toBe('lifetime');
    expect(s.settings.plan).toBe('free');
  });

  it('unlocks nothing when the notice is dismissed', () => {
    const asked = reducer(base(), { type: 'upgrade-ask', period: 'yearly' }, TODAY);
    const closed = reducer(asked, { type: 'upgrade-cancel' }, TODAY);
    expect(closed.upgrading).toBeNull();
    expect(closed.settings.plan).toBe('free');
  });

  it('closes the notice when the unlock it was asking about goes through', () => {
    const asked = reducer(base(), { type: 'upgrade-ask', period: 'monthly' }, TODAY);
    const done = reducer(asked, { type: 'settings', patch: { plan: 'pro' } }, TODAY);
    expect(done.settings.plan).toBe('pro');
    expect(done.upgrading).toBeNull();
  });
});

describe('what the celebration is allowed to claim', () => {
  const closed = (over: Partial<Receipt> = {}): Receipt => ({
    ...receipt('late'),
    // 60 days ago on a 30-day window: the shop's window shut a month back.
    purchasedOn: toISODate(addDays(TODAY, -60)),
    ...over,
  });

  it('does not say "before the window closed" when it had closed', () => {
    // The button is offered on any active receipt, and a refund won after the
    // window — goodwill, or the faulty-goods route — is the harder one.
    const s = reducer(base({ receipts: [closed()] }), { type: 'return', id: 'late' }, TODAY);
    expect(s.celebrating?.inTime).toBe(false);
  });

  it('says it when the window really was open', () => {
    const s = reducer(base(), { type: 'return', id: 'a' }, TODAY);
    expect(s.celebrating?.inTime).toBe(true);
  });

  it('does not claim kept warned you when kept said nothing', () => {
    // The shareable line said "kept. reminded me before the window shut"
    // whether or not it had — a claim about the product, put in the user's
    // mouth, to be sent to their friends.
    const s = reducer(base({ alertsSent: [] }), { type: 'return', id: 'a' }, TODAY);
    expect(s.celebrating?.warned).toBe(false);
  });

  it('claims it when an alert really went out for that receipt', () => {
    const s = reducer(base({ alertsSent: ['a:soon'] }), { type: 'return', id: 'a' }, TODAY);
    expect(s.celebrating?.warned).toBe(true);
  });

  it('does not count an alert about a different receipt', () => {
    const s = reducer(base({ alertsSent: ['b:soon'] }), { type: 'return', id: 'a' }, TODAY);
    expect(s.celebrating?.warned).toBe(false);
  });
});

describe('the onboarding flow reaches its last slide', () => {
  it('advances through every step and finishes on the last', () => {
    // The reducer carried the last index as a literal 2 while
    // ONBOARDING_STEPS sat exported and unused. A fourth slide would have
    // been written, rendered, counted in "Step 4 of 4" — and unreachable.
    expect(ONBOARDING_STEPS).toBeGreaterThan(1);
    let s = base({ screen: 'onboard', obStep: 0, onboardingSeen: false });
    for (let i = 1; i < ONBOARDING_STEPS; i += 1) {
      s = reducer(s, { type: 'ob-next' }, TODAY);
      expect(s.obStep, `after ${i} taps`).toBe(i);
      expect(s.screen, `after ${i} taps`).toBe('onboard');
    }
    s = reducer(s, { type: 'ob-next' }, TODAY);
    expect(s.screen).toBe('home');
    expect(s.onboardingSeen).toBe(true);
  });
});

describe('the selection survives the trip to edit and back', () => {
  /*
   * Found by mutation: `screen === 'detail' || screen === 'edit'` flipped to
   * `&&` is a condition no screen can satisfy, so `selId` would be cleared on
   * every navigation — including the one from a receipt to its own edit form.
   * The whole suite passed. The comment above the line says the selection
   * survives in both directions; nothing checked that it does.
   */
  it('keeps the receipt when going from detail to edit', () => {
    const s = reducer(base({ screen: 'detail', selId: 'a' }), { type: 'go', screen: 'edit' }, TODAY);
    expect(s.selId).toBe('a');
  });

  it('keeps it coming back from edit to detail', () => {
    const s = reducer(base({ screen: 'edit', selId: 'a' }), { type: 'go', screen: 'detail' }, TODAY);
    expect(s.selId).toBe('a');
  });

  it('lets it go on the way to any other screen', () => {
    const s = reducer(base({ screen: 'detail', selId: 'a' }), { type: 'go', screen: 'settings' }, TODAY);
    expect(s.selId).toBeNull();
  });
});

describe('a receipt cannot be returned twice', () => {
  /*
   * `if (!r || r.status === 'returned') return state;` flipped to `&&` is
   * never true, so a second "returned" on the same receipt would go through:
   * a fresh returnedOn overwriting the real one, and the celebration screen
   * again for money that came back last week. A double tap on the swipe
   * action is all it takes.
   */
  it('ignores a second return of the same receipt', () => {
    const once = reducer(base(), { type: 'return', id: 'a' }, TODAY);
    const twice = reducer(once, { type: 'return', id: 'a' }, addDays(TODAY, 3));
    expect(twice).toBe(once);
    expect(twice.receipts.find((r) => r.id === 'a')?.returnedOn).toBe(toISODate(TODAY));
  });

  it('ignores a return of a receipt that is not there', () => {
    const s = base();
    expect(reducer(s, { type: 'return', id: 'nope' }, TODAY)).toBe(s);
  });
});

describe('putting a receipt back after a swipe', () => {
  /*
   * `unreturn` had no test at all, and neither did `update`. Both map over the
   * whole library changing the one whose id matches, and flipping that `===` to
   * `!==` changes every OTHER receipt instead — one accidental swipe, or one
   * saved edit, and the rest of somebody's library is overwritten.
   *
   * The assertion that catches it is the one about the receipt NOT being acted
   * on. Checking only the target passes either way.
   */
  const returned = (id: string) => ({
    ...receipt(id), status: 'returned' as const, returnedOn: '2026-08-20',
  });

  it('makes the swiped one active again', () => {
    const start = base({ receipts: [returned('a'), receipt('b')] });
    const next = reducer(start, { type: 'unreturn', id: 'a' }, TODAY);
    expect(next.receipts.find((r) => r.id === 'a')).toMatchObject({ status: 'active' });
    expect(next.receipts.find((r) => r.id === 'a')!.returnedOn).toBeUndefined();
  });

  it('leaves every other receipt exactly as it was', () => {
    const start = base({ receipts: [returned('a'), returned('b')] });
    const next = reducer(start, { type: 'unreturn', id: 'a' }, TODAY);
    expect(next.receipts.find((r) => r.id === 'b')).toEqual(returned('b'));
  });
});

describe('saving an edit', () => {
  it('replaces the one that was edited', () => {
    const edited = { ...receipt('a'), item: 'Stand mixer, cream' };
    const next = reducer(base(), { type: 'update', receipt: edited }, TODAY);
    expect(next.receipts.find((r) => r.id === 'a')!.item).toBe('Stand mixer, cream');
    expect(next.screen).toBe('detail');
    expect(next.selId).toBe('a');
  });

  it('leaves every other receipt exactly as it was', () => {
    // The one that matters. With the comparison flipped, saving a single edit
    // rewrites every receipt in the library with the edited one's contents.
    const edited = { ...receipt('a'), item: 'Stand mixer, cream' };
    const next = reducer(base(), { type: 'update', receipt: edited }, TODAY);
    expect(next.receipts.find((r) => r.id === 'b')).toEqual(receipt('b'));
    expect(next.receipts).toHaveLength(2);
  });
});

describe('which screen a launch opens on', () => {
  /*
   * Lifted out of `useReducer`'s initialiser, where it was three conditions
   * nothing could reach: mutating either half of `onboardingSeen || embedded`
   * left the whole suite green, and that decides whether a first-time visitor
   * meets the app or a flow they never asked for.
   */
  it.each([
    ['a shared order beats everything else', { shared: true, onboardingSeen: false, embedded: false }, 'add'],
    ['even inside the demo frame', { shared: true, onboardingSeen: true, embedded: true }, 'add'],
    ['a returning visitor goes to their receipts', { shared: false, onboardingSeen: true, embedded: false }, 'home'],
    ['a first-time visitor is onboarded', { shared: false, onboardingSeen: false, embedded: false }, 'onboard'],
    ['the demo frame skips onboarding', { shared: false, onboardingSeen: false, embedded: true }, 'home'],
  ])('%s', (_label, input, expected) => {
    expect(openingScreen(input)).toBe(expected);
  });
});

/**
 * Three ways the reducer lost track of what it had already done — each found
 * by a review of src/app and confirmed by running the reducer.
 */
describe('a shared order email, once saved', () => {
  it('is not offered again the next time Add opens', () => {
    // `sharedText` was never cleared, so every later visit to Add re-read the
    // shared email and offered it for saving again: two rows, the money
    // counted twice.
    const shared = base({ sharedText: 'Your Currys order · Total £29.00', screen: 'add' });
    const saved = reducer(shared, { type: 'add', receipt: receipt('new') }, TODAY);
    expect(saved.sharedText).toBeNull();
    const back = reducer(saved, { type: 'go', screen: 'add' }, TODAY);
    expect(back.sharedText).toBeNull();
  });

  it('is still there if Add is left without saving', () => {
    const shared = base({ sharedText: 'Your Currys order · Total £29.00', screen: 'add' });
    const away = reducer(shared, { type: 'go', screen: 'home' }, TODAY);
    expect(away.sharedText).toBe('Your Currys order · Total £29.00');
  });
});

describe('what kept has already said, across a delete and its undo', () => {
  it('comes back with the receipt', () => {
    // 'delete' pruned the receipt's alert keys; 'undo-delete' restored the
    // receipt without them, so an alert already shown was shown again, and
    // returning it lost its "kept reminded me".
    const said = base({ alertsSent: ['a:soon', 'b:today'] });
    const gone = reducer(said, { type: 'delete', id: 'a' }, TODAY);
    const back = reducer(gone, { type: 'undo-delete' }, TODAY);
    expect(back.receipts.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect([...back.alertsSent].sort()).toEqual(['a:soon', 'b:today']);
  });

  it('is forgotten once the undo is no longer on offer', () => {
    const gone = reducer(base({ alertsSent: ['a:soon', 'b:today'] }), { type: 'delete', id: 'a' }, TODAY);
    expect(reducer(gone, { type: 'dismiss-undo' }, TODAY).alertsSent).toEqual(['b:today']);
    expect(reducer(gone, { type: 'go', screen: 'settings' }, TODAY).alertsSent).toEqual(['b:today']);
  });

  it('and a second delete forgets the first, which can no longer be undone', () => {
    const one = reducer(base({ alertsSent: ['a:soon', 'b:today'] }), { type: 'delete', id: 'a' }, TODAY);
    const two = reducer(one, { type: 'delete', id: 'b' }, TODAY);
    expect(two.alertsSent).toEqual(['b:today']);
  });
});

describe('an edit that moves the deadline', () => {
  it('lets the alerts fire again against the new one', () => {
    // The rungs already used against the old deadline stayed recorded, so a
    // window corrected from 14 to 30 days on its last day never warned at the
    // real three-days-left or last day.
    const said = base({ alertsSent: ['a:soon', 'a:today', 'b:soon'] });
    const moved = reducer(said, { type: 'update', receipt: { ...receipt('a'), windowDays: 45 } }, TODAY);
    expect(moved.alertsSent).toEqual(['b:soon']);
  });

  it('but an edit that leaves the deadline where it was forgets nothing', () => {
    const said = base({ alertsSent: ['a:soon', 'b:soon'] });
    const renamed = reducer(said, { type: 'update', receipt: { ...receipt('a'), item: 'Stand mixer' } }, TODAY);
    expect(renamed.alertsSent).toEqual(['a:soon', 'b:soon']);
  });
});

describe('returning a sample', () => {
  const sample = (id: string): Receipt => ({ ...receipt(id), demo: true, store: 'Currys', amount: toPence(89) });

  it('is not celebrated once there is real money beside it', () => {
    // "MONEY BACK £89.00", and a shareable "Just got £89.00 back from Currys",
    // about a purchase nobody made — beside a "kept back so far" that left it out.
    const next = reducer(base({ receipts: [sample('s'), receipt('mine')] }), { type: 'return', id: 's' }, TODAY);
    expect(next.screen).toBe('home');
    expect(next.celebrating).toBeNull();
    expect(next.receipts.find((r) => r.id === 's')!.status).toBe('returned');
  });

  it('is celebrated while the samples are all there is', () => {
    const next = reducer(base({ receipts: [sample('s'), sample('t')] }), { type: 'return', id: 's' }, TODAY);
    expect(next.screen).toBe('celebrate');
    expect(next.celebrating?.amount).toBe(toPence(89));
  });
});

describe('keeping it', () => {
  /*
   * The commonest end to a purchase had no action: the only exits were
   * "returned" and Delete, so a kept item nagged, then sat under WINDOW CLOSED
   * for good, and deleting it threw away its warranty and its rights.
   */
  it('settles an active receipt as kept, on today', () => {
    const next = reducer(base(), { type: 'keep', id: 'a' }, TODAY);
    const a = next.receipts.find((r) => r.id === 'a')!;
    expect(a.status).toBe('kept');
    expect(a.keptOn).toBe(toISODate(TODAY));
    expect(next.receipts.find((r) => r.id === 'b')!.status).toBe('active');
  });

  it('does not turn a refund into a kept item', () => {
    const returned = { ...receipt('a'), status: 'returned' as const, returnedOn: '2026-08-20' };
    const next = reducer(base({ receipts: [returned] }), { type: 'keep', id: 'a' }, TODAY);
    expect(next.receipts[0]).toEqual(returned);
  });

  it('can be taken back, and forgets the date it was decided', () => {
    const kept = reducer(base(), { type: 'keep', id: 'a' }, TODAY);
    const back = reducer(kept, { type: 'unkeep', id: 'a' }, TODAY).receipts.find((r) => r.id === 'a')!;
    expect(back.status).toBe('active');
    expect(back.keptOn).toBeUndefined();
  });

  it('a kept item that goes back after all is a return, with no kept date left on it', () => {
    const kept = reducer(base(), { type: 'keep', id: 'a' }, TODAY);
    const a = reducer(kept, { type: 'return', id: 'a' }, TODAY).receipts.find((r) => r.id === 'a')!;
    expect(a.status).toBe('returned');
    expect(a.keptOn).toBeUndefined();
  });
});

describe('keeping the closed windows in one tap', () => {
  /*
   * A library left alone fills with windows that shut months ago, each red
   * under WINDOW CLOSED and the oldest on the hero card in place of the next
   * deadline that can still be met. Clearing them meant opening every one.
   */
  const shut = (id: string): Receipt => ({ ...receipt(id), purchasedOn: '2026-06-01', windowDays: 14 });
  const backlog = () =>
    base({ receipts: [shut('x'), shut('y'), receipt('open'), { ...shut('gone'), status: 'returned', returnedOn: '2026-06-05' }] });

  it('keeps every closed window it is given, on today, and offers them back', () => {
    const next = reducer(backlog(), { type: 'keep-closed', ids: ['x', 'y'] }, TODAY);
    expect(next.receipts.filter((r) => r.status === 'kept').map((r) => r.id).sort()).toEqual(['x', 'y']);
    expect(next.receipts.find((r) => r.id === 'x')!.keptOn).toBe(toISODate(TODAY));
    expect([...next.justKept!].sort()).toEqual(['x', 'y']);
  });

  it('decides for itself what is closed and still active, whatever the screen sent', () => {
    // An open window, a refund and an id that no longer exists are not the
    // person's to have settled by a tap on the closed section.
    const next = reducer(backlog(), { type: 'keep-closed', ids: ['x', 'open', 'gone', 'vanished'] }, TODAY);
    expect(next.justKept).toEqual(['x']);
    expect(next.receipts.find((r) => r.id === 'open')!.status).toBe('active');
    expect(next.receipts.find((r) => r.id === 'gone')!.status).toBe('returned');
  });

  it('does nothing, and offers nothing, when nothing qualifies', () => {
    const before = backlog();
    expect(reducer(before, { type: 'keep-closed', ids: ['open'] }, TODAY)).toBe(before);
  });

  it('undo puts them all back to active, dates cleared', () => {
    const kept = reducer(backlog(), { type: 'keep-closed', ids: ['x', 'y'] }, TODAY);
    const undone = reducer(kept, { type: 'undo-keep' }, TODAY);
    for (const id of ['x', 'y']) {
      const r = undone.receipts.find((q) => q.id === id)!;
      expect(r.status).toBe('active');
      expect(r.keptOn).toBeUndefined();
    }
    expect(undone.justKept).toBeNull();
  });

  it('undo leaves alone one that was reopened and returned since', () => {
    const kept = reducer(backlog(), { type: 'keep-closed', ids: ['x', 'y'] }, TODAY);
    const returned = { ...kept, receipts: kept.receipts.map((r) => (r.id === 'y' ? { ...r, status: 'returned' as const, keptOn: undefined, returnedOn: toISODate(TODAY) } : r)) };
    const undone = reducer(returned, { type: 'undo-keep' }, TODAY);
    expect(undone.receipts.find((r) => r.id === 'y')!.status).toBe('returned');
    expect(undone.receipts.find((r) => r.id === 'x')!.status).toBe('active');
  });

  it('the offer goes when it is dismissed or navigated past, and the keep stands', () => {
    const kept = reducer(backlog(), { type: 'keep-closed', ids: ['x'] }, TODAY);
    for (const next of [reducer(kept, { type: 'dismiss-undo' }, TODAY), reducer(kept, { type: 'go', screen: 'settings' }, TODAY)]) {
      expect(next.justKept).toBeNull();
      expect(next.receipts.find((r) => r.id === 'x')!.status).toBe('kept');
    }
  });

  it('one undo on offer at a time', () => {
    const deleted = reducer(backlog(), { type: 'delete', id: 'open' }, TODAY);
    const kept = reducer(deleted, { type: 'keep-closed', ids: ['x'] }, TODAY);
    expect(kept.justDeleted).toBeNull();
    expect(reducer(kept, { type: 'delete', id: 'y' }, TODAY).justKept).toBeNull();
  });
});

describe('undoing a return', () => {
  /*
   * The swipe that marks a return fires on a row you might have meant to
   * open. Delete had a way back; this, the easier one to trigger, did not —
   * undoing it meant finding the receipt under MONEY BACK and opening it.
   */
  // Two real receipts, so a return is celebrated rather than tidied away.
  const real = () => base({ receipts: [receipt('a'), receipt('b')] });

  it('is offered after a return, and puts the receipt back as it was', () => {
    const returned = reducer(real(), { type: 'return', id: 'a' }, TODAY);
    expect(returned.screen).toBe('celebrate');
    expect(returned.justReturned).toEqual({ id: 'a', was: { status: 'active', keptOn: undefined } });
    const undone = reducer(returned, { type: 'undo-return' }, TODAY);
    const a = undone.receipts.find((r) => r.id === 'a')!;
    expect(a.status).toBe('active');
    expect(a.returnedOn).toBeUndefined();
    expect(undone.justReturned).toBeNull();
  });

  it('leaves the celebration, which has nothing left to celebrate', () => {
    const undone = reducer(reducer(real(), { type: 'return', id: 'a' }, TODAY), { type: 'undo-return' }, TODAY);
    expect(undone.screen).toBe('home');
    expect(undone.celebrating).toBeNull();
  });

  it('puts a kept item that was returned after all back under keeping it, with its date', () => {
    const kept = reducer(real(), { type: 'keep', id: 'a' }, addDays(TODAY, -3));
    const undone = reducer(reducer(kept, { type: 'return', id: 'a' }, TODAY), { type: 'undo-return' }, TODAY);
    const a = undone.receipts.find((r) => r.id === 'a')!;
    expect(a.status).toBe('kept');
    expect(a.keptOn).toBe(toISODate(addDays(TODAY, -3)));
  });

  it('is offered for a sample tidied away too, with no celebration', () => {
    const samples = base({ receipts: [{ ...receipt('s'), demo: true }, receipt('mine')] });
    const returned = reducer(samples, { type: 'return', id: 's' }, TODAY);
    expect(returned.screen).toBe('home');
    expect(returned.justReturned?.id).toBe('s');
    expect(reducer(returned, { type: 'undo-return' }, TODAY).receipts.find((r) => r.id === 's')!.status).toBe('active');
  });

  it('leaves alone a receipt changed since, and goes when dismissed or navigated past', () => {
    const returned = reducer(real(), { type: 'return', id: 'a' }, TODAY);
    // Reopened in another tab and kept there: nothing an undo would produce.
    const reopened = { ...returned, receipts: returned.receipts.map((r) => (r.id === 'a' ? { ...r, status: 'kept' as const, returnedOn: undefined, keptOn: '2026-08-27' } : r)) };
    expect(reducer(reopened, { type: 'undo-return' }, TODAY).receipts).toEqual(reopened.receipts);
    expect(reducer(returned, { type: 'dismiss-undo' }, TODAY).justReturned).toBeNull();
    const gone = reducer(returned, { type: 'go', screen: 'home' }, TODAY);
    expect(gone.justReturned).toBeNull();
    expect(gone.receipts.find((r) => r.id === 'a')!.status).toBe('returned');
  });

  it('one undo on offer at a time', () => {
    const deleted = reducer(real(), { type: 'delete', id: 'b' }, TODAY);
    const returned = reducer(deleted, { type: 'return', id: 'a' }, TODAY);
    expect(returned.justDeleted).toBeNull();
    expect(reducer(returned, { type: 'delete', id: 'a' }, TODAY).justReturned).toBeNull();
  });
});

describe('an edit forgets only what it made stale', () => {
  // Each clock on its own: a guarantee corrected after its reminder fired
  // was never reminded about again, and moving the return deadline forgot the
  // guarantee reminder too, so it could arrive twice.
  const covered = { ...receipt('a'), warranty: { months: 12 } };
  const said = ['a:week', 'a:soon', 'a:warranty', 'b:week'];
  const edit = (r: typeof covered) => reducer(base({ receipts: [covered, receipt('b')], alertsSent: said }), { type: 'update', receipt: r }, TODAY).alertsSent;

  it('re-arms the guarantee reminder when its length changes, and leaves the return reminders', () => {
    expect(edit({ ...covered, warranty: { months: 24 } }).sort()).toEqual(['a:soon', 'a:week', 'b:week']);
  });

  it('re-arms the return reminders when the deadline moves, and leaves the guarantee one', () => {
    expect(edit({ ...covered, windowDays: 60 }).sort()).toEqual(['a:warranty', 'b:week']);
  });

  it('forgets nothing when neither clock moves', () => {
    expect(edit({ ...covered, item: 'Stand mixer' }).sort()).toEqual([...said].sort());
  });
});
