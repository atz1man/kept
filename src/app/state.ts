import { useEffect, useReducer, useState } from 'react';
import { alertKey, pruneSent, remindedBeforeWindow } from '../lib/alerts';
import { planAlerts } from '../lib/schedule';
import { isNative } from '../lib/mirror';
import { cleanupPhotos } from '../lib/photos';
import { onNotificationTap, syncScheduled } from './schedule-native';
import { currentDay, daysBetween, fromISODate, startOfDay, toISODate } from '../lib/dates';
import { sharedTextFrom, strippedShareUrl } from '../lib/share';
import { awaitingArrival, countsAsMoney, derive, makeReceiptId, refundOf } from '../lib/receipts';
import { windowStartFor } from '../lib/draft';
import { readReturnRef } from '../lib/refund-chase';
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
   * The receipt just saved, held only long enough to offer it back. Saving
   * dropped the person on the list with nothing to say it had worked, or
   * where the new row went, and a receipt saved from the wrong email could be
   * removed only by finding it and deleting it.
   */
  justAdded: string | null;
  /**
   * The receipt just marked returned, and what it was before, held only long
   * enough to offer it back. The swipe that marks a return is a one-finger
   * gesture on a row you might have meant to open, so it fires by accident;
   * delete had an undo and this, the easier one to trigger, did not. `was`
   * because a kept item can be returned after all, and undoing that must put
   * it back under KEEPING IT with its date, not into the deadlines.
   */
  justReturned: { id: string; was: Pick<Receipt, 'status' | 'keptOn'> } | null;
  /** Marked as posted back, offered back from the bar — the swipe on an online order lands here. */
  justSent: string | null;
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
  /*
   * `id` and `cost` so the figure can be corrected where it is celebrated: a
   * £30 refund on a £60 order was shown, and shared, as "£60 back".
   */
  celebrating: { id: string; amount: number; cost: number; store: string; inTime: boolean; warned: boolean } | null;
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
  | { type: 'clear-samples' }
  | { type: 'sync'; state: KeptState }
  | { type: 'add'; receipt: Receipt }
  | { type: 'update'; receipt: Receipt }
  | { type: 'restore'; receipts: Receipt[] }
  | { type: 'alerted'; keys: string[] }
  | { type: 'feed'; updates: PolicyUpdate[] }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'keep'; id: string }
  /** `undoable`: from the swipe, which fires on rows people meant to open; the receipt's own screen has "Not sent after all" beside it. */
  | { type: 'send'; id: string; undoable?: boolean }
  | { type: 'cancel-sent'; id: string }
  | { type: 'cancel-unsent'; id: string }
  | { type: 'set-refund'; id: string; pence: number | null }
  | { type: 'set-credit'; id: string; credit: { expires?: string } | null }
  | { type: 'credit-spent'; id: string }
  | { type: 'credit-unspent'; id: string }
  | { type: 'unsend'; id: string }
  | { type: 'fault-sent'; id: string; what: string }
  | { type: 'fault-unsent'; id: string }
  | { type: 'set-return-ref'; id: string; ref: string | null }
  | { type: 'arrived'; id: string }
  | { type: 'unkeep'; id: string }
  | { type: 'keep-closed'; ids: string[] }
  | { type: 'undo-keep' }
  | { type: 'undo-return' }
  | { type: 'undo-send' }
  | { type: 'undo-add' }
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
        justKept: null, justReturned: null, justSent: null, justAdded: null,
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
        ? { ...state, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, screen: 'detail', selId: action.id }
        : { ...state, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, screen: 'home', selId: null };
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
        // `sentOn` stays: it is the day that decides whether this was in time.
        x.id === action.id ? { ...x, status: 'returned' as const, returnedOn: toISODate(today), keptOn: undefined, refunded: undefined, credit: undefined } : x,
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
        // No `sentOn` to hold: a return never clears it, so undo finds it on the receipt.
        justReturned: { id: r.id, was: { status: r.status, keptOn: r.keptOn } },
        justSent: null,
        justDeleted: null,
        justKept: null,
        justAdded: null,
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
          id: r.id,
          amount: r.amount,
          cost: r.amount,
          store: r.store,
          // Judged on the day it went back, where that was recorded: posted on
          // day 27 and refunded on day 35 is a return made in time.
          inTime: r.sentOn
            ? daysBetween(fromISODate(r.sentOn), derive(r, today).deadline) >= 0
            : !derive(r, today).expired,
          // What the share line claims is a reminder before the window shut —
          // not the guarantee alert, not the refund chase, not "window closed".
          warned: remindedBeforeWindow(state.alertsSent, r.id),
        },
        shared: 'no',
        selId: null,
      };
    }
    case 'unreturn':
      /*
       * The swipe is a one-finger gesture on a row you might have meant to
       * open, so it is going to fire by accident. Putting the receipt back is
       * the whole point of being able to reach it again.
       *
       * One step back, not two. A receipt that was POSTED and then marked
       * refunded goes back to waiting for the refund: the parcel went, and
       * what is being taken back is the money. Sending it to active wiped the
       * day it was posted and its tracking number, and started "go now or
       * lose it" alerts about a parcel already at the warehouse. Undoing the
       * posting as well is the next tap, "Not sent after all", which says so.
       */
      return {
        ...state,
        receipts: state.receipts.map((r) =>
          r.id !== action.id || r.status !== 'returned'
            ? r
            : r.sentOn
              ? { ...r, status: 'sent' as const, returnedOn: undefined, refunded: undefined, credit: undefined }
              : { ...r, status: 'active' as const, returnedOn: undefined, refunded: undefined, returnRef: undefined, credit: undefined },
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
    case 'set-refund': {
      /*
       * Less than was paid, recorded after the fact: the refund arrives, and
       * it is £30 of the £60. Only on a refund, never more than the price,
       * and the whole price (or null) clears it back to the one-tap case.
       */
      const receipts = state.receipts.map((r) => {
        if (r.id !== action.id || r.status !== 'returned') return r;
        const p = action.pence;
        if (p === null || p === r.amount) return { ...r, refunded: undefined };
        if (!Number.isInteger(p) || p < 0 || p > r.amount) return r;
        return { ...r, refunded: p };
      });
      const changed = receipts.find((r) => r.id === action.id);
      // The celebration of this very refund follows it, and a line already
      // shared about the old figure is not a line shared about this one.
      const celebrating =
        state.celebrating && changed && state.celebrating.id === action.id && refundOf(changed) !== state.celebrating.amount
          ? { ...state.celebrating, amount: refundOf(changed) }
          : state.celebrating;
      return {
        ...state,
        receipts,
        celebrating,
        ...(celebrating !== state.celebrating ? { shared: 'no' as const } : {}),
      };
    }
    case 'set-credit': {
      /*
       * Store credit instead of money, and the day it runs out where the note
       * says. Only on a refund. An expiry that is not a real date, or falls
       * before the day it was given, is refused rather than stored: a
       * reminder planned for a day that cannot exist fires never or at once.
       */
      const r = state.receipts.find((x) => x.id === action.id);
      if (!r || r.status !== 'returned') return state;
      const expires = action.credit?.expires;
      if (expires !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || toISODate(fromISODate(expires)) !== expires) return state;
        if (r.returnedOn && daysBetween(fromISODate(r.returnedOn), fromISODate(expires)) < 0) return state;
      }
      // The day it was spent survives a corrected expiry; "It was money after
      // all" takes the whole credit, spent or not.
      const spentOn = r.credit?.spentOn;
      const next: Receipt = { ...r, credit: action.credit ? { ...(expires ? { expires } : {}), ...(spentOn ? { spentOn } : {}) } : undefined };
      // A reminder already given about a different expiry says nothing about this one.
      const moved = (r.credit?.expires ?? '') !== (next.credit?.expires ?? '');
      const key = alertKey(r.id, 'credit');
      return {
        ...state,
        receipts: state.receipts.map((x) => (x.id === r.id ? next : x)),
        alertsSent: moved ? state.alertsSent.filter((k) => k !== key) : state.alertsSent,
      };
    }
    case 'credit-spent':
      /*
       * Spent. Credit was the one thing kept could be told about and never
       * told it had gone: "spend it before then" still fired a month before
       * the note's date on credit used the week it was given, and the only
       * ways to stop it — clear the date, or "It was money after all" — made
       * the record say something false. Only on credit not already spent.
       */
      return {
        ...state,
        receipts: state.receipts.map((r) =>
          r.id === action.id && r.status === 'returned' && r.credit && !r.credit.spentOn
            ? { ...r, credit: { ...r.credit, spentOn: toISODate(today) } }
            : r,
        ),
      };
    case 'credit-unspent':
      return {
        ...state,
        receipts: state.receipts.map((r) => {
          if (r.id !== action.id || !r.credit?.spentOn) return r;
          const { spentOn: _gone, ...credit } = r.credit;
          return { ...r, credit };
        }),
      };
    case 'fault-sent':
      /*
       * The fault letter has gone. On a receipt still with its owner — active
       * or kept — which is where the panel that writes it lives. The words
       * are kept, tidied, so the letter can be shown again as it was sent.
       */
      return {
        ...state,
        receipts: state.receipts.map((r) => {
          if (r.id !== action.id || (r.status !== 'active' && r.status !== 'kept')) return r;
          const what = action.what.trim().replace(/\s+/g, ' ');
          return { ...r, faultClaim: { sentOn: toISODate(today), ...(what ? { what } : {}) } };
        }),
        // A reply asked about for an earlier letter says nothing about this one.
        alertsSent: state.alertsSent.filter((k) => k !== alertKey(action.id, 'fault')),
      };
    case 'fault-unsent':
      return {
        ...state,
        receipts: state.receipts.map((r) => (r.id === action.id ? { ...r, faultClaim: undefined } : r)),
        alertsSent: state.alertsSent.filter((k) => k !== alertKey(action.id, 'fault')),
      };
    case 'cancel-sent':
      /*
       * Notice of cancellation has gone. Only on an online order still in
       * hand, and once: the first day it went is the day the law counts from.
       */
      return {
        ...state,
        receipts: state.receipts.map((r) =>
          r.id === action.id && r.distance && r.status === 'active' && !r.cancelledOn ? { ...r, cancelledOn: toISODate(today) } : r,
        ),
      };
    case 'cancel-unsent':
      return {
        ...state,
        receipts: state.receipts.map((r) => (r.id === action.id && r.cancelledOn ? { ...r, cancelledOn: undefined } : r)),
      };
    case 'send':
      /*
       * Gone back, money still to come. From active only: a kept item that
       * turns out faulty goes back through "Not keeping it after all" first,
       * which is one tap and says what happened; a refund has already ended.
       */
    {
      const r = state.receipts.find((x) => x.id === action.id);
      if (!r || r.status !== 'active') return state;
      return {
        ...state,
        receipts: state.receipts.map((x) =>
          x.id === action.id ? { ...x, status: 'sent' as const, sentOn: toISODate(today) } : x,
        ),
        // Offered back like a return when it came from the swipe: on a phone
        // that is how an online order is sent, and a swipe fires on rows
        // people meant to open. One undo on offer at a time.
        ...(action.undoable
          ? {
              justSent: r.id,
              justReturned: null,
              justKept: null,
              justAdded: null,
              justDeleted: null,
              alertsSent: state.justDeleted ? pruneSent(state.alertsSent, state.receipts) : state.alertsSent,
            }
          : {}),
      };
    }
    case 'unsend':
      return {
        ...state,
        receipts: state.receipts.map((r) =>
          r.id === action.id && r.status === 'sent' ? { ...r, status: 'active' as const, sentOn: undefined, returnRef: undefined } : r,
        ),
      };
    case 'set-return-ref':
      /*
       * Proof it went, added the day it goes. Only while it is on its way: a
       * reference means nothing on a receipt that has not been sent, and one
       * the screen would refuse is refused here too.
       */
      return {
        ...state,
        receipts: state.receipts.map((r) => {
          if (r.id !== action.id || r.status !== 'sent') return r;
          const read = readReturnRef(action.ref ?? '');
          if (!read.ok) return r;
          return { ...r, returnRef: read.ref ?? undefined };
        }),
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
        justAdded: null,
        // One undo on offer at a time; a delete's is forgotten as if dismissed.
        justDeleted: null,
        justReturned: null, justSent: null,
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
            ? { ...r, status: held.was.status, returnedOn: undefined, keptOn: held.was.keptOn, refunded: undefined, credit: undefined }
            : r,
        ),
        justReturned: null, justSent: null,
        // Off the celebration: there is nothing to celebrate.
        ...(state.screen === 'celebrate' ? { screen: 'home' as const, celebrating: null } : {}),
      };
    }
    case 'undo-send': {
      const id = state.justSent;
      if (!id) return state;
      return {
        ...state,
        // Only while it is still the posting this tap made: one refunded or
        // put back since is left as it now is.
        receipts: state.receipts.map((r) =>
          r.id === id && r.status === 'sent' ? { ...r, status: 'active' as const, sentOn: undefined, returnRef: undefined } : r,
        ),
        justSent: null,
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
        justKept: null, justReturned: null, justSent: null, justAdded: null,
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
        justKept: null, justReturned: null, justSent: null, justAdded: null,
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
      if (state.justAdded) return { ...state, justAdded: null };
      if (state.justKept) return { ...state, justKept: null };
      if (state.justReturned) return { ...state, justReturned: null, justSent: null };
      if (state.justSent) return { ...state, justSent: null };
      return state.justDeleted
        ? { ...state, justDeleted: null, alertsSent: pruneSent(state.alertsSent, state.receipts) }
        : state;
    case 'add':
      // A shared email is spent once it is saved. It was never cleared, so
      // every later visit to Add re-read it and offered it again — two rows,
      // the money counted twice. Leaving Add WITHOUT saving keeps it.
      // Offered back at once, the only undo on offer; a delete's is forgotten.
      return {
        ...state,
        receipts: [...state.receipts, action.receipt],
        screen: 'home',
        sharedText: null,
        justAdded: action.receipt.id,
        justDeleted: null,
        justKept: null,
        justReturned: null, justSent: null,
        alertsSent: state.justDeleted ? pruneSent(state.alertsSent, state.receipts) : state.alertsSent,
      };
    case 'undo-add': {
      const id = state.justAdded;
      if (!id) return state;
      const receipts = state.receipts.filter((r) => r.id !== id);
      return { ...state, receipts, justAdded: null, alertsSent: pruneSent(state.alertsSent, receipts) };
    }
    case 'arrived': {
      /*
       * "It arrived today" — the one tap that turns a floor into a date. The
       * arrival starts both statutory clocks, and the shop's own for a shop
       * that counts from delivery; `windowStartFor` is the same rule an edit
       * saves by, so the two ways of saying it cannot disagree. Routed through
       * `update` so a moved deadline forgets what was said about the old one.
       */
      const r = state.receipts.find((x) => x.id === action.id);
      if (!r || !awaitingArrival(r, today)) return state;
      const arrivedOn = toISODate(today);
      const receipt: Receipt = {
        ...r,
        arrivedOn,
        windowStartsOn: windowStartFor(r.store, { dispatchedOn: r.windowStartsOn, arrivedOn, distance: r.distance }),
      };
      return reducer(state, { type: 'update', receipt }, today);
    }
    case 'update': {
      /*
       * An edit that moves the deadline makes what was already said about the
       * old one meaningless. The rungs stayed recorded, so a window corrected
       * from 14 days to 30 on its last day never warned at the real
       * three-days-left or last day — the moment a warning was for.
       */
      /*
       * Each clock on its own. The guarantee's end moves with its length (or
       * the purchase date), and a length corrected after its reminder fired
       * was never reminded about again; and moving the RETURN deadline used
       * to forget the guarantee reminder too, so it could arrive twice.
       */
      const before = state.receipts.find((r) => r.id === action.receipt.id);
      const id = action.receipt.id;
      const coverEnd = (r: Receipt) => {
        const w = derive(r, today).warranty;
        return w ? toISODate(w.ends) : '';
      };
      const moved =
        !before ||
        toISODate(derive(before, today).deadline) !== toISODate(derive(action.receipt, today).deadline);
      const coverMoved = !before || coverEnd(before) !== coverEnd(action.receipt);
      const forget = new Set<string>([
        ...(moved ? (['week', 'soon', 'today', 'closed'] as const).map((rung) => alertKey(id, rung)) : []),
        ...(coverMoved ? [alertKey(id, 'warranty')] : []),
      ]);
      return {
        ...state,
        alertsSent: forget.size > 0 ? state.alertsSent.filter((k) => !forget.has(k)) : state.alertsSent,
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
        justKept: null, justReturned: null, justSent: null, justAdded: null,
        selId: null,
        screen: 'home',
      };
    case 'clear-samples': {
      /*
       * The five samples, and nothing else. They had no way out but deleting
       * each in turn or Erase everything, which takes the real receipts with
       * them, so they sat on the list beside real purchases for good. No undo
       * on offer: nothing anybody spent goes with them, and the library they
       * leave behind is exactly the person's own.
       */
      if (!state.receipts.some((r) => r.demo)) return state;
      const receipts = state.receipts.filter((r) => !r.demo);
      const gone = (id: string | null) => !!id && !receipts.some((r) => r.id === id);
      return {
        ...state,
        receipts,
        alertsSent: pruneSent(state.alertsSent, receipts),
        // An undo that names a sample would put it back; one that names a
        // real receipt is left on offer.
        justDeleted: state.justDeleted?.demo ? null : state.justDeleted,
        justKept: state.justKept?.some((id) => gone(id)) ? null : state.justKept,
        justReturned: gone(state.justReturned?.id ?? null) ? null : state.justReturned,
        justAdded: gone(state.justAdded) ? null : state.justAdded,
        justSent: gone(state.justSent) ? null : state.justSent,
        ...(gone(state.selId) ? { selId: null, screen: 'home' as const } : {}),
      };
    }
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
        justKept: null, justReturned: null, justSent: null, justAdded: null,
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
