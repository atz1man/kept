import { useEffect, useReducer, useState } from 'react';
import { pruneSent } from '../lib/alerts';
import { planAlerts } from '../lib/schedule';
import { isNative } from '../lib/mirror';
import { cleanupPhotos } from '../lib/photos';
import { onNotificationTap, syncScheduled } from './schedule-native';
import { currentDay, startOfDay, toISODate } from '../lib/dates';
import { sharedTextFrom, strippedShareUrl } from '../lib/share';
import { countsAsMoney, derive, makeReceiptId } from '../lib/receipts';
import { freshState, load, onExternalChange, save, type KeptState, type Settings } from '../lib/storage';
import { quotaFull as quotaFullFor } from '../lib/quota';
import { ONBOARDING_STEPS } from './screens/Onboarding';
import { sellsPaidTiers, type Period } from '../lib/pricing';
import type { PolicyUpdate, Receipt, Screen } from '../lib/types';

export interface AppState extends KeptState {
  screen: Screen;
  /** An order email shared in from another app, waiting for the Add screen. */
  sharedText: string | null;
  /** True in the landing page's iframe demo: nothing is read or written to disk. */
  embedded: boolean;
  /**
   * The receipt just deleted, held only long enough to offer it back.
   * Deliberately not persisted: if the app is closed during the window the
   * delete stands, which is the safer reading of walking away.
   */
  justDeleted: Receipt | null;
  /**
   * The receipts just settled as kept in one tap from WINDOW CLOSED, held
   * only long enough to offer them back — the same timed undo as a delete,
   * and for the same reason: one tap moved several rows at once.
   */
  justKept: string[] | null;
  /**
   * The receipt just marked returned, and what it was before, held only long
   * enough to offer it back. The swipe that marks a return is a one-finger
   * gesture on a row you might have meant to open, so it fires by accident;
   * delete had an undo and this, the easier one to trigger, did not. `was`
   * because a kept item can be returned after all, and undoing that must put
   * it back under KEEPING IT with its date, not into the deadlines.
   */
  justReturned: { id: string; was: Pick<Receipt, 'status' | 'keptOn'> } | null;
  /** The receipt open on the detail screen. */
  selId: string | null;
  obStep: number;
  /**
   * The refund the celebrate screen is showing; null when it is not showing
   * one.
   *
   * `inTime` and `warned` are recorded at the moment of the return because
   * the screen was asserting both of them unconditionally. It said "Recovered
   * from IKEA before the window closed" on a receipt whose window had closed —
   * the button is offered on any active receipt, expired or not, and a refund
   * won after the window (goodwill, or the faulty-goods route) is exactly the
   * one worth celebrating. And the shareable line said "kept. reminded me
   * before the window shut" whether or not kept had said anything at all: a
   * claim about the product, put in the user's mouth, to be sent to their
   * friends.
   */
  celebrating: { amount: number; store: string; inTime: boolean; warned: boolean } | null;
  /**
   * What happened when the win was shared. Not a boolean, because "the copy
   * failed" and "it has not been tried" are different things to say — and the
   * button said "Copied ✓" for both.
   */
  shared: 'no' | 'shared' | 'copied' | 'failed';
  /**
   * The tier someone tapped, waiting to be told what tapping it actually does.
   *
   * It used to do this: flip `plan` to 'pro', immediately, with no card, no
   * confirmation and no word about either. Someone taps "£39.99 lifetime",
   * the paywall disappears, and the only reading available to them is that
   * they were charged £39.99. Payments are not built (see the README), so
   * nothing was — and an app that shows a price, takes a tap, and then behaves
   * as though money changed hands is making a claim about their bank account
   * that is not true.
   */
  upgrading: Period | null;
}

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'open'; id: string }
  | { type: 'ob-next' }
  | { type: 'ob-skip' }
  | { type: 'return'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'unreturn'; id: string }
  | { type: 'undo-delete' }
  | { type: 'dismiss-undo' }
  | { type: 'wipe' }
  | { type: 'sync'; state: KeptState }
  | { type: 'add'; receipt: Receipt }
  | { type: 'update'; receipt: Receipt }
  | { type: 'restore'; receipts: Receipt[] }
  | { type: 'alerted'; keys: string[] }
  | { type: 'feed'; updates: PolicyUpdate[] }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'keep'; id: string }
  | { type: 'unkeep'; id: string }
  | { type: 'keep-closed'; ids: string[] }
  | { type: 'undo-keep' }
  | { type: 'undo-return' }
  | { type: 'shared'; outcome: 'shared' | 'copied' | 'failed' }
  | { type: 'upgrade-ask'; period: Period }
  | { type: 'upgrade-cancel' };

/**
 * Which screen a launch opens on.
 *
 * Three-way and easy to get subtly wrong, and it was inline in `useReducer`
 * where nothing could reach it — mutating either half of its condition left the
 * whole suite green.
 *
 * A shared order wins over everything: someone who shared an order email is
 * telling you exactly what they came to do, whether or not they ever finished
 * onboarding. The landing page's demo iframe skips onboarding too, because a
 * visitor who has never opened the app should land on the receipts list rather
 * than on step one of a flow they cannot see the point of yet.
 */
export function openingScreen(
  { shared, onboardingSeen, embedded }: { shared: boolean; onboardingSeen: boolean; embedded: boolean },
): Screen {
  if (shared) return 'add';
  return onboardingSeen || embedded ? 'home' : 'onboard';
}

export function reducer(state: AppState, action: Action, today: Date): AppState {
  switch (action.type) {
    case 'go':
      // The edit screen belongs to the receipt open behind it, so the
      // selection survives the trip in both directions.
      return {
        ...state,
        justDeleted: null,
        justKept: null, justReturned: null,
        // The undo is gone, so what was said about the receipt it held goes too.
        alertsSent: state.justDeleted ? pruneSent(state.alertsSent, state.receipts) : state.alertsSent,
        screen: action.screen,
        selId: action.screen === 'detail' || action.screen === 'edit' ? state.selId : null,
      };
    case 'open': {
      /*
       * Only if it is still held.
       *
       * Every caller inside the app passes an id off a row that is on screen,
       * so this could not previously miss. A tapped notification can: it was
       * lodged with iOS days or weeks earlier and the receipt may have been
       * returned, deleted, or erased since. `App.tsx` renders the detail screen
       * as `screen === 'detail' && selected`, so a missing one is not an error
       * — it is a blank page under the tab bar, which is the exact failure
       * `Recovery` exists for and a miserable thing to meet from a lock screen.
       *
       * The list is the honest answer: the receipt is genuinely not there. The
       * same reasoning the `sync` case applies when another tab deletes what
       * this one has open.
       */
      const held = state.receipts.some((r) => r.id === action.id);
      return held
        ? { ...state, justDeleted: null, justKept: null, justReturned: null, screen: 'detail', selId: action.id }
        : { ...state, justDeleted: null, justKept: null, justReturned: null, screen: 'home', selId: null };
    }
    case 'ob-next':
      return state.obStep >= ONBOARDING_STEPS - 1
        ? { ...state, screen: 'home', onboardingSeen: true }
        : { ...state, obStep: state.obStep + 1 };
    case 'ob-skip':
      return { ...state, screen: 'home', onboardingSeen: true };
    case 'return': {
      const r = state.receipts.find((x) => x.id === action.id);
      if (!r || r.status === 'returned') return state;
      const receipts = state.receipts.map((x) =>
        x.id === action.id ? { ...x, status: 'returned' as const, returnedOn: toISODate(today), keptOn: undefined } : x,
      );
      /*
       * A sample, once there is real money beside it, is tidied away — not
       * celebrated. The screen said "MONEY BACK £89.00" and offered to share
       * "Just got £89.00 back from Currys" about a purchase nobody made, beside
       * a "kept back so far" that rightly left it out. Same rule as the totals
       * (`countsAsMoney`): while the samples are all there is, returning one
       * IS the demonstration, and it is celebrated.
       */
      // Offered back either way: celebrated or tidied away, it may have been
      // the wrong row. The only undo on offer; a delete's is forgotten as if
      // dismissed.
      const undo = {
        justReturned: { id: r.id, was: { status: r.status, keptOn: r.keptOn } },
        justDeleted: null,
        justKept: null,
        alertsSent: state.justDeleted ? pruneSent(state.alertsSent, state.receipts) : state.alertsSent,
      };
      if (!countsAsMoney(state.receipts)(r)) {
        return { ...state, receipts, screen: 'home', selId: null, ...undo };
      }
      return {
        ...state,
        receipts,
        ...undo,
        screen: 'celebrate',
        celebrating: {
          amount: r.amount,
          store: r.store,
          inTime: !derive(r, today).expired,
          // Any rung counts: what the line claims is that kept said something
          // before this happened, not which rung it was.
          warned: state.alertsSent.some((k) => k.startsWith(`${r.id}:`)),
        },
        shared: 'no',
        selId: null,
      };
    }
    case 'unreturn':
      // The swipe is a one-finger gesture on a row you might have meant to
      // open, so it is going to fire by accident. Putting the receipt back is
      // the whole point of being able to reach it again.
      return {
        ...state,
        receipts: state.receipts.map((r) =>
          r.id === action.id ? { ...r, status: 'active' as const, returnedOn: undefined } : r,
        ),
      };
    case 'keep':
      // Only an active receipt: a returned one has already ended, and keeping
      // it would bury the refund the money-back total counts.
      return {
        ...state,
        receipts: state.receipts.map((r) =>
          r.id === action.id && r.status === 'active' ? { ...r, status: 'kept' as const, keptOn: toISODate(today) } : r,
        ),
      };
    case 'unkeep':
      return {
        ...state,
        receipts: state.receipts.map((r) =>
          r.id === action.id && r.status === 'kept' ? { ...r, status: 'active' as const, keptOn: undefined } : r,
        ),
      };
    case 'keep-closed': {
      /*
       * The backlog, cleared in one tap. A library left alone fills up with
       * windows that shut months ago: each one red under WINDOW CLOSED, the
       * oldest of them on the hero card in place of the next deadline that
       * can still be met, and clearing them meant opening every one.
       *
       * Only receipts that are still active AND whose window has shut, decided
       * here rather than trusted from the screen: an id that was returned in
       * another tab, or a window that turned out to be open, is not the
       * person's to have settled by this tap.
       */
      const ids = new Set(
        state.receipts
          .filter((r) => action.ids.includes(r.id) && r.status === 'active' && derive(r, today).daysLeft < 0)
          .map((r) => r.id),
      );
      if (ids.size === 0) return state;
      const on = toISODate(today);
      return {
        ...state,
        receipts: state.receipts.map((r) => (ids.has(r.id) ? { ...r, status: 'kept' as const, keptOn: on } : r)),
        justKept: [...ids],
        // One undo on offer at a time; a delete's is forgotten as if dismissed.
        justDeleted: null,
        justReturned: null,
        alertsSent: state.justDeleted ? pruneSent(state.alertsSent, state.receipts) : state.alertsSent,
      };
    }
    case 'undo-return': {
      const held = state.justReturned;
      if (!held) return state;
      return {
        ...state,
        // Only if it is still the refund this tap made: one reopened and
        // changed since, here or in another tab, is left as it now is.
        receipts: state.receipts.map((r) =>
          r.id === held.id && r.status === 'returned'
            ? { ...r, status: held.was.status, returnedOn: undefined, keptOn: held.was.keptOn }
            : r,
        ),
        justReturned: null,
        // Off the celebration: there is nothing to celebrate.
        ...(state.screen === 'celebrate' ? { screen: 'home' as const, celebrating: null } : {}),
      };
    }
    case 'undo-keep': {
      const ids = new Set(state.justKept ?? []);
      if (ids.size === 0) return state;
      return {
        ...state,
        // Only what is still kept: one reopened on its own since is left alone.
        receipts: state.receipts.map((r) =>
          ids.has(r.id) && r.status === 'kept' ? { ...r, status: 'active' as const, keptOn: undefined } : r,
        ),
        justKept: null, justReturned: null,
      };
    }
    case 'delete': {
      const removed = state.receipts.find((x) => x.id === action.id) ?? null;
      const receipts = state.receipts.filter((x) => x.id !== action.id);
      return {
        ...state,
        receipts,
        // Held so it can be offered back. Delete is one tap, immediate, and
        // was the only action in the app with no way out — a backup is not an
        // undo.
        justDeleted: removed,
        justKept: null, justReturned: null,
        // Forget what we said about receipts that no longer exist, so the
        // sent-list cannot grow without bound over years of use — but NOT yet
        // about this one. It is on offer to undo, and an undo that brought
        // the receipt back without the record of its alerts showed them all
        // again and lost the "kept reminded me" when it was returned. It is
        // forgotten when the undo is: dismissed, navigated past, or replaced
        // by the next delete.
        alertsSent: pruneSent(state.alertsSent, removed ? [...receipts, removed] : receipts),
        screen: 'home',
        selId: null,
      };
    }
    case 'undo-delete': {
      const restoring = state.justDeleted;
      if (!restoring) return state;
      // Another tab can put the receipt back before the undo is tapped — its
      // own state still had it, and adopting that is the point of `sync`. In
      // practice the other tab usually adopts the delete first, but a lost or
      // late event leaves this reachable, and a duplicated receipt is a bad
      // way to find out: two rows, and the money counted twice.
      if (state.receipts.some((r) => r.id === restoring.id)) return { ...state, justDeleted: null };
      return { ...state, receipts: [...state.receipts, restoring], justDeleted: null };
    }
    case 'dismiss-undo':
      if (state.justKept) return { ...state, justKept: null };
      if (state.justReturned) return { ...state, justReturned: null };
      return state.justDeleted
        ? { ...state, justDeleted: null, alertsSent: pruneSent(state.alertsSent, state.receipts) }
        : state;
    case 'add':
      // A shared email is spent once it is saved. It was never cleared, so
      // every later visit to Add re-read it and offered it again — two rows,
      // the money counted twice. Leaving Add WITHOUT saving keeps it.
      return { ...state, receipts: [...state.receipts, action.receipt], screen: 'home', sharedText: null };
    case 'update': {
      /*
       * An edit that moves the deadline makes what was already said about the
       * old one meaningless. The rungs stayed recorded, so a window corrected
       * from 14 days to 30 on its last day never warned at the real
       * three-days-left or last day — the moment a warning was for.
       */
      const before = state.receipts.find((r) => r.id === action.receipt.id);
      const moved =
        !before ||
        toISODate(derive(before, today).deadline) !== toISODate(derive(action.receipt, today).deadline);
      return {
        ...state,
        alertsSent: moved ? state.alertsSent.filter((k) => !k.startsWith(`${action.receipt.id}:`)) : state.alertsSent,
        receipts: state.receipts.map((r) => (r.id === action.receipt.id ? action.receipt : r)),
        screen: 'detail',
        selId: action.receipt.id,
      };
    }
    case 'restore':
      // Deliberately stays on Settings: the screen reports what the restore
      // actually did ("12 restored · 2 updated"), and bouncing to the list
      // would throw that away at the moment it matters most.
      return {
        ...state,
        receipts: action.receipts,
        alertsSent: pruneSent(state.alertsSent, action.receipts),
        selId: null,
      };
    case 'settings':
      // Any settings change closes the notice: the only one that reaches it
      // is the unlock it was asking about, and leaving the sheet up over an
      // app that has just unlocked would be its own small lie.
      return { ...state, settings: { ...state.settings, ...action.patch }, upgrading: null };
    case 'upgrade-ask':
      return { ...state, upgrading: action.period };
    case 'upgrade-cancel':
      return { ...state, upgrading: null };
    case 'wipe':
      // Everything, including what the app remembers about having spoken:
      // alert keys naming receipts that no longer exist would be a residue of
      // exactly the thing the user just asked to be rid of.
      return {
        ...state,
        receipts: [],
        alertsSent: [],
        justDeleted: null,
        justKept: null, justReturned: null,
        selId: null,
        screen: 'home',
      };
    case 'sync': {
      // Adopt what another tab stored, keeping this tab's transient UI —
      // screen, selection, an undo still on offer. If the receipt open here
      // was deleted there, fall back rather than showing a blank detail.
      const stillThere = state.selId && action.state.receipts.some((r) => r.id === state.selId);
      return {
        ...state,
        ...action.state,
        selId: stillThere ? state.selId : null,
        screen: stillThere || (state.screen !== 'detail' && state.screen !== 'edit') ? state.screen : 'home',
      };
    }
    case 'feed':
      return { ...state, updates: action.updates };
    case 'alerted':
      // Recorded only for what was actually shown (plus the gentler rungs it
      // superseded), so an alert that failed to display is tried again rather
      // than lost.
      return { ...state, alertsSent: [...new Set([...state.alertsSent, ...action.keys])] };
    case 'shared':
      return { ...state, shared: action.outcome };
  }
}

/**
 * `today` is fixed for the life of the session rather than read per render:
 * every screen derives its day-counts from it, and a value that changed
 * mid-render would let the home list and the detail ring disagree by a day
 * across a midnight boundary.
 */
export function useApp() {
  /**
   * The current day, and it has to stay current.
   *
   * This was memoised once per session, which is wrong for the one kind of app
   * where it matters most: phones resume a PWA from the background rather than
   * reloading it, so a deadline tracker left open overnight went on reporting
   * yesterday's counts — "2 days left" on the morning it had become the last
   * day. Every number on every screen derives from this value.
   *
   * Checked when the app comes back to the foreground, which is the common
   * case, and on a slow interval for the app that simply stays open. The
   * comparison is on the calendar day, so this sets state only when the date
   * actually turns over.
   */
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    const check = () => setToday((current) => currentDay(current, new Date()));
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);
  const [state, rawDispatch] = useReducer(
    (s: AppState, a: Action) => reducer(s, a, today),
    today,
    (t): AppState => {
      const persisted = load(t);
      // The landing page embeds this same build in an iframe as its live
      // demo. A visitor who has never opened the app should land on the
      // receipts list there, not on step one of an onboarding flow they
      // cannot see the point of yet.
      const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const embedded = params.has('embed');
      const incoming = sharedTextFrom(params);
      // The demo on the marketing page is this same build at this same origin,
      // so it was reading and writing the real app's storage: swipe a receipt
      // in the shop window and you had changed what the installed app shows.
      // It runs entirely in memory instead — fully working, resetting to the
      // designed state on every load, touching nothing.
      const base = embedded ? freshState(t) : persisted;
      return {
        ...base,
        // A shared order goes straight to Add, whether or not onboarding was
        // ever finished: someone who shared an email is telling you exactly
        // what they came to do.
        screen: openingScreen({ shared: incoming !== null, onboardingSeen: base.onboardingSeen, embedded }),
        sharedText: incoming,
        embedded,
        justDeleted: null,
        justKept: null, justReturned: null,
        selId: null,
        obStep: 0,
        celebrating: null,
        shared: 'no',
        upgrading: null,
      };
    },
  );

  // Strip the shared payload from the address bar once it is in hand: a
  // reload must not silently re-add the same receipt, and an order email has
  // no business sitting in browser history.
  useEffect(() => {
    if (typeof location === 'undefined' || typeof history === 'undefined') return;
    const stripped = strippedShareUrl(location.href);
    if (stripped !== null) history.replaceState(null, '', stripped);
  }, []);

  /**
   * Whether the last write reached the disk. There is no server behind this,
   * so a failed write means the data is gone at the next launch while the
   * screen still shows it — the app has to say so.
   */
  const [saveFailed, setSaveFailed] = useState(false);

  // Another tab of the same app writes the whole library too. Adopting its
  // state is what stops this tab writing its own older copy over the top.
  useEffect(() => {
    if (state.embedded) return undefined;
    return onExternalChange((incoming) => rawDispatch({ type: 'sync', state: incoming }), today);
  }, [state.embedded, today]);

  useEffect(() => {
    if (state.embedded) return;
    const ok = save({
      version: state.version,
      receipts: state.receipts,
      updates: state.updates,
      onboardingSeen: state.onboardingSeen,
      settings: state.settings,
      alertsSent: state.alertsSent,
    });
    setSaveFailed(!ok);
  }, [state.embedded, state.version, state.receipts, state.updates, state.onboardingSeen, state.settings, state.alertsSent]);

  /*
   * Pictures whose receipt has gone, cleared once per launch.
   *
   * Not at the moment of deletion, because deleting is UNDOABLE here — the
   * undo bar restores the receipt, and it would come back to a photo already
   * thrown away. By the next launch the undo has been taken or it has not, and
   * the disk can safely follow the library. It also catches what no delete
   * path could: a photo left by a restore that replaced the library.
   *
   * Once, on the receipts the app booted with. Re-running it on every change
   * would race the undo it exists to respect.
   */
  useEffect(() => {
    if (state.embedded || !isNative()) return;
    void cleanupPhotos(state.receipts.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.embedded]);

  /*
   * A tapped notification opens the receipt it is about.
   *
   * The scheduler has been attaching `receiptId` to every alert since it was
   * written and nothing read it — a thing declared with nothing reading it,
   * which is a defect class this codebase has caught four times and had no
   * business reintroducing. Either the field goes or it is used; it earns its
   * place by taking someone from the lock screen to the coat.
   *
   * Registered once, not on every state change: the handler dispatches, and
   * the reducer is what knows whether the receipt is still held.
   */
  useEffect(() => {
    if (state.embedded || !isNative()) return undefined;
    let stop: (() => void) | undefined;
    let done = false;
    void onNotificationTap((id, key) => {
      /*
       * A tap is PROOF the system delivered it, and proof is the only thing
       * worth recording here.
       *
       * `alertsSent` is not only dedup: the celebration reads it to decide
       * whether to say "kept reminded me before the window shut", and that
       * line was once printed whether or not kept had said anything. On iOS
       * the system delivers while the app is closed, so nothing was recorded
       * and the celebration UNDERSTATED — it omitted credit kept had earned.
       *
       * Deliberately not inferred from the clock instead. "Its 9am has passed,
       * so it must have been delivered" is false whenever notifications are
       * refused at the system level, and being wrong THAT way puts the
       * original defect back: claiming a warning that never arrived. An
       * untapped alert therefore still goes unrecorded, which understates
       * rather than overstates, and that is the direction to be wrong in.
       */
      rawDispatch({ type: 'alerted', keys: [key] });
      rawDispatch({ type: 'open', id });
    }).then((off) => {
      if (done) off();
      else stop = off;
    });
    return () => {
      done = true;
      stop?.();
    };
  }, [state.embedded]);

  /*
   * Lodge the deadlines with iOS, so they arrive when the app is closed.
   *
   * Re-run whenever anything the plan is derived from moves: the receipts, the
   * urgency slider, and the record of what has already been said. `today`
   * too — a phone left overnight rolls the date and every deadline with it.
   *
   * The switch has to SWITCH. Turning deadline alerts off cancels what is
   * already lodged rather than merely declining to add more; otherwise
   * everything scheduled before the toggle keeps arriving for weeks, and the
   * control would be a stored boolean nothing acted on — which is exactly what
   * `policyWatch` turned out to be, on the row directly above it in Settings.
   */
  useEffect(() => {
    if (state.embedded || !isNative()) return;
    if (!state.settings.deadlineAlerts) {
      void syncScheduled([]);
      return;
    }
    void syncScheduled(
      planAlerts(state.receipts, today, state.settings.urgentDays, new Set(state.alertsSent)),
      state.settings.remindersExplained,
    );
  }, [
    state.embedded,
    state.receipts,
    state.settings.deadlineAlerts,
    state.settings.remindersExplained,
    state.settings.urgentDays,
    state.alertsSent,
    today,
  ]);

  return { state, dispatch: rawDispatch, today, saveFailed };
}

export function quotaFull(state: AppState): boolean {
  // No cap where there is nothing to buy — see sellsPaidTiers.
  return sellsPaidTiers(isNative()) && quotaFullFor(state.receipts, state.settings.plan);
}

export { makeReceiptId };
