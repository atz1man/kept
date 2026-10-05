import { addDays, fromISODate, toISODate } from './dates';
import { deadlineIsFloor, derive } from './receipts';
import { canonicalStoreName } from './stores';
import { MAX_WINDOW_DAYS } from './draft';
import { midSentence } from './words';
import type { PolicyUpdate, Receipt } from './types';

/**
 * Policy updates, and what they actually mean for receipts already held.
 *
 * Two claims were being made that needed separating. "Kept ships verified
 * policy updates the day they change" is a delivery problem, solved below by
 * fetching a feed instead of freezing one into the bundle. "Every deadline on
 * your receipts re-calculates itself" is a different claim, and a wrong one:
 * the terms a purchase was made under are the terms that govern it, so
 * silently rewriting an existing receipt's window because a shop changed its
 * page would tell someone they have less time than they actually do.
 *
 * What the app can honestly do — and what the design's own Zara card already
 * said, "your deadlines: unchanged, already checked" — is CHECK. A receipt
 * keeps the window it was bought under; the change is surfaced, with what it
 * would have meant, and the person decides.
 */

export type ImpactKind = 'unchanged' | 'shorter' | 'longer' | 'informational';

export interface ReceiptImpact {
  receipt: Receipt;
  kind: ImpactKind;
  /** One line, in the second person, about this receipt specifically. */
  note: string;
}

export interface AssessedUpdate {
  update: PolicyUpdate;
  /** Only receipts the person actually holds. Empty means this is just news. */
  impacts: ReceiptImpact[];
  affectsYou: boolean;
}

/**
 * The return window in force at a shop on the day something was bought.
 *
 * The feed's whole purpose is to carry a change the bundled table does not
 * know about yet, and `newWindowDays` was read for exactly one thing: telling
 * the holder of an existing receipt how their deadline compares. So the app
 * would say, in the Watch tab, "new purchases get 16 days less; yours keeps
 * the 30 days it was bought under" — and then hand a NEW purchase from that
 * same shop the table's 30 days. A deadline sixteen days later than the shop
 * will honour, on a receipt added minutes after the app said so, which is the
 * overstating direction and the one failure this app must not have.
 *
 * Dated, not merely latest. A change that happened after the purchase does not
 * govern it — that is the same rule the sentence above states, applied to the
 * purchase rather than to the reader — and it is what lets a receipt entered
 * late still get the window it was actually bought under.
 *
 * On two changes dated the same day, the shorter wins. It is arbitrary as
 * arithmetic and not as judgement: everywhere else here, the tie goes to the
 * answer that cannot tell someone they have longer than they do.
 *
 * It returns the DATE as well as the number, because the receipt's policy
 * sentence has to say where its window came from — "as entered, not verified"
 * was written when a window differing from the table could only have been
 * typed by a person, and is untrue of one the app took from its own watch.
 *
 * Note what this hands the feed: the power to move a computed deadline, where
 * before it could only move words on a screen. That is the point of the
 * feature and it is also a wider blast radius, which is why signing the feed
 * is on the list in the README rather than merely nice to have. `mergeFeed`
 * already refuses a window that is not a positive integer.
 */
export interface WindowInForce {
  days: number;
  /** The day the change took effect, for the sentence the receipt carries. */
  changedOn: string;
}

/**
 * Does this update name that shop?
 *
 * One predicate, because there were two and they answered differently.
 * `assess` — which decides whether the Watch tab tells you a change is yours
 * — asked `affectsStores.includes(receipt.store)`, an exact match.
 * `windowInForceFor` — which decides what window a NEW receipt from that shop
 * is given — asked the same question case-insensitively. `affectsStores`
 * arrives over the network and `readFeed` takes it verbatim, so the two
 * answers parted company on nothing more than how the feed happened to
 * capitalise a name.
 *
 * A feed entry saying `["currys"]` would then shorten every new Currys
 * purchase's window while the Watch tab showed that same change as not
 * affecting you: the app acting on a change it had just said was not yours,
 * silently, in the direction that takes days off.
 *
 * Lenient rather than strict, because the failure of strictness here is
 * silence — the receipt edited to "boots" that carried Boots' policy with
 * every Boots change invisible to it was exactly that — and because the
 * casing of a shop's name in a hand-authored feed is not a distinction
 * anybody means.
 *
 * Through `canonicalStoreName` for the same reason one step further out. The
 * table gives Currys the alias "pc world", M&S "marks and spencer", B&Q "b and
 * q" — and `readFeed` takes `affectsStores` verbatim, so an entry written
 * `["PC World"]`, which is how a person writes it, matched no receipt at all
 * and said nothing to anybody. Silence again, from the same cause: a name
 * compared as a string where the app already knows it is one shop. Receipts
 * are canonicalised at their own door for exactly this; the feed had no such
 * door. A name the table does not know passes through untouched, so this can
 * only ever join two spellings of a shop, never invent a match.
 */
function updateNames(update: PolicyUpdate, store: string): boolean {
  const name = canonicalStoreName(store).toLowerCase();
  if (!name) return false;
  return update.affectsStores.some((s) => canonicalStoreName(s).toLowerCase() === name);
}

/**
 * Does this update speak to this receipt?
 *
 * The shop has to match, and a SAMPLE change speaks only to a sample receipt.
 * The seed's changes are illustrations nobody verified; left to match by shop
 * alone, a real Zara coat added on day one was told "Zara changed its returns
 * policy — your coat is affected", on the list screen, over a change that may
 * never have happened. Sample-to-sample keeps the demo whole — the sample Zara
 * coat still shows what a change looks like when it lands — without the app
 * making a claim about a named shop to someone's actual purchase.
 */
export function speaksTo(update: PolicyUpdate, receipt: Receipt): boolean {
  if (update.demo && !receipt.demo) return false;
  return updateNames(update, receipt.store);
}

export function windowInForceFor(
  store: string,
  purchasedOn: string,
  updates: readonly PolicyUpdate[],
): WindowInForce | undefined {
  let onDate = '';
  let days: number | undefined;
  for (const u of updates) {
    if (u.newWindowDays === undefined) continue;
    // A sample never moves a real deadline. The seed's windows happen to agree
    // with the table today, which is exactly why this was invisible: the day
    // someone corrects the table from the retailer's own page, a sample dated
    // before the purchase would have quietly overruled the correction.
    if (u.demo) continue;
    if (!updateNames(u, store)) continue;
    // ISO dates compare correctly as strings, which is half of why they are
    // stored this way.
    if (u.changedOn > purchasedOn) continue;
    if (u.changedOn > onDate) {
      onDate = u.changedOn;
      days = u.newWindowDays;
    } else if (u.changedOn === onDate && days !== undefined) {
      days = Math.min(days, u.newWindowDays);
    }
  }
  return days === undefined ? undefined : { days, changedOn: onDate };
}

function impactFor(update: PolicyUpdate, receipt: Receipt, today: Date): ReceiptImpact {
  const next = update.newWindowDays;
  const note = update.affectNote.trim();
  if (next === undefined) {
    // A note is not guaranteed: `mergeFeed` defaults a missing one to ''. The
    // renderer writes "{item} — {note}", so an empty one printed a dangling
    // dash after the receipt's name.
    return { receipt, kind: 'informational', note: note || 'worth a read — your deadline is unaffected' };
  }
  if (next === receipt.windowDays) {
    /*
     * Unchanged is the common case, and it was the one that threw the
     * feed's own advice away.
     *
     * Zara's change was the postal-returns fee: the window stayed 30 days,
     * so this branch fired and told the holder of a Zara coat "deadline
     * unchanged, already checked" — true, and useless, while the sentence
     * that would have saved them £1.95, "drop off in store to keep it
     * free", sat in the same update unread. Currys the same: the price-match
     * note is the whole point of that entry and its window did not move.
     *
     * The reassurance still leads, because "has my deadline moved" is the
     * question the tab exists to answer. The advice follows it, after a "·"
     * rather than a dash: the card already writes "{item} — {note}", and two
     * em-dashes in one line read as one sentence interrupted twice.
     */
    return { receipt, kind: 'unchanged', note: note ? `deadline unchanged · ${note}` : 'deadline unchanged, already checked' };
  }
  // Below, `affectNote` is deliberately NOT used. It is written for someone
  // reading the news — ASOS's "your window is the shorter one" — and for a
  // receipt already held it is false: that receipt keeps the window it was
  // bought under. The derived sentence is both more specific and true.
  const days = Math.abs(next - receipt.windowDays);
  const unit = days === 1 ? 'day' : 'days';
  /*
   * "Yours keeps the window it was bought under" is only true of a purchase
   * made BEFORE the change. One made on or after it was bought under the NEW
   * window — it carries the old number only because it was added before the
   * feed reached this phone, and reassuring its holder that the longer window
   * stands overstates the deadline by exactly the change. Said plainly, and
   * not silently rewritten: the person edits it, as with any other number
   * the app cannot be sure of.
   */
  if (receipt.purchasedOn >= update.changedOn) {
    return {
      receipt,
      kind: next < receipt.windowDays ? 'shorter' : 'longer',
      note:
        `bought after this change, so the shop gives it ${next} days — ${days} ${unit} ` +
        `${next < receipt.windowDays ? 'fewer' : 'more'} than this receipt counts. Edit it to match`,
    };
  }
  // Equality already returned above, so `<` and `<=` cannot disagree here and
  // no test can tell them apart. Recorded rather than left to be re-derived.
  if (next < receipt.windowDays) {
    // The frightening case, and the one the app exists for. Deliberately
    // reassuring about what does NOT change: the receipt keeps its own terms.
    const d = derive(receipt, today);
    return {
      receipt,
      kind: 'shorter',
      note:
        `new purchases get ${days} ${unit} less; yours keeps the ${receipt.windowDays} days it was bought under ` +
        `(${d.daysLeft < 0 ? (deadlineIsFloor(receipt) ? 'window may have closed' : 'window closed') : `${d.daysLeft} days left`})`,
    };
  }
  return {
    receipt,
    kind: 'longer',
    note: `new purchases get ${days} ${unit} more; yours keeps the ${receipt.windowDays} days it was bought under`,
  };
}

export function assess(updates: readonly PolicyUpdate[], receipts: readonly Receipt[], today: Date): AssessedUpdate[] {
  const active = receipts.filter((r) => r.status === 'active');
  return updates.map((update) => {
    const impacts = active
      .filter((r) => speaksTo(update, r))
      .map((r) => impactFor(update, r, today));
    return { update, impacts, affectsYou: impacts.length > 0 };
  });
}

/**
 * What the receipts list says when a change lands on something held: the
 * banner's line, and which rows carry the badge.
 *
 * It lived in App.tsx and asked its own question — `affectsStores` against
 * the held shops by exact string — beside `assess`, which the Watch tab reads
 * and which canonicalises names. Two answers to "is this yours?" on two
 * screens one tap apart; and the App's copy knew nothing about samples, so
 * the seed's invented Zara change announced itself over a real Zara coat.
 * Now it is `assess`, filtered.
 *
 * The badges were keyed by SHOP name for the same reason, so they had the same
 * hole. "Sample:" leads when every change behind the line is one. It also counts SHOPS by
 * name rather than updates: one shop with two receipts used to read "1 shops
 * changed their returns policies".
 */
export interface PolicyAlert {
  /** The banner's sentence, or null when no change lands on anything held. */
  line: string | null;
  /** Ids of the receipts a change lands on — the row badges and the tab dot. */
  changed: ReadonlySet<string>;
}

export function policyAlertFor(
  updates: readonly PolicyUpdate[],
  receipts: readonly Receipt[],
  today: Date,
): PolicyAlert {
  const hits = assess(updates, receipts, today).filter((a) => a.affectsYou);
  const held = new Map<string, Receipt>();
  for (const a of hits) for (const i of a.impacts) held.set(i.receipt.id, i.receipt);
  const affected = [...held.values()];
  const changed = new Set(held.keys());
  if (affected.length === 0) return { line: null, changed };
  const lead = hits.every((a) => a.update.demo) ? 'Sample: ' : '';
  const shops = new Set(affected.map((r) => r.store));
  const line =
    affected.length === 1
      ? `${lead}${affected[0].store} changed its returns policy — your ${midSentence(affected[0].item)} is affected`
      : shops.size === 1
        ? `${lead}${affected[0].store} changed its returns policy — ${affected.length} of your receipts are affected`
        : `${lead}${shops.size} shops changed their returns policies — your receipts are affected`;
  return { line, changed };
}

/**
 * How much news this app is willing to carry.
 *
 * The updates live in the same localStorage bucket as the receipts, and until
 * this cap existed nothing ever removed one: `mergeFeed` was union-only by
 * design, so the list could only grow. That is fine while the feed behaves and
 * indefensible when it does not — one oversized or misgenerated response is
 * persisted permanently, and no later, correct feed shrinks it again. What
 * fails then is not the Watch tab being long: it is `save` refusing the whole
 * state, so the receipts stop persisting, and the only way out is Erase
 * everything, which takes the receipts too.
 *
 * A count is the right bound rather than an age, because an age limit still
 * admits ten thousand changes all dated today. Two hundred is far more news
 * than anyone reads — about 60KB — and is deliberately applied by date, so
 * what gets forgotten is the oldest, which is also the least likely to be
 * about a receipt still inside its window.
 */
// The exact number is a judgement, not a property: 201 would do as well, so no
// test pins it. What is asserted next door is that the cap APPLIES, that the
// newest survive it, and that what is kept stays inside the size it was chosen
// for — which is what a much larger value would actually break.
export const MAX_UPDATES = 200;

/** Newest first, and no more of them than we are willing to keep. */
function newestFirst(updates: PolicyUpdate[]): PolicyUpdate[] {
  return updates.sort((a, b) => b.changedOn.localeCompare(a.changedOn)).slice(0, MAX_UPDATES);
}

/**
 * Merge a downloaded feed over what is already held.
 *
 * By id, newest wins, and anything only present locally survives — the same
 * discipline as a backup restore, for the same reason: a feed that failed to
 * mention an update must not delete it. Bounded, though: see MAX_UPDATES for
 * why "never delete" could not stay unqualified.
 *
 * The one thing a feed DOES remove is the samples, and only once it carries a
 * real change. A sample is there so the tab is not empty; beside a real
 * change it is noise that reads as news. An empty feed — the state this ships
 * in — leaves them where they are, so an install with nothing published yet
 * still shows what the tab is for.
 */
export function mergeFeed(current: readonly PolicyUpdate[], incoming: readonly PolicyUpdate[]): PolicyUpdate[] {
  const real = incoming.some((u) => !u.demo);
  const byId = new Map(current.filter((u) => !(real && u.demo)).map((u) => [u.id, u]));
  for (const u of incoming) byId.set(u.id, u);
  return newestFirst([...byId.values()]);
}

/*
 * How much of anything one downloaded entry may be.
 *
 * `readFeed` checked what each field WAS and never how much of it there was.
 * That was survivable while the feed could only put words on a screen. It is
 * not now: `newWindowDays` sets a real receipt's window, and the number the
 * edit form refuses from a person — anything past ten years — was accepted
 * from the network without a glance. A ceiling only one of the two paths
 * respects is not a ceiling.
 *
 * The lengths are the same argument one level down. The receipts and the feed
 * share one localStorage bucket, the feed is the half that arrives from
 * outside, and this codebase has already had the version of this where it
 * could only ever grow. A policy note is a sentence; a shop is a name.
 *
 * An entry that breaks a limit is DROPPED, not trimmed. The text is advice
 * somebody may repeat at a counter — half of it is worse than none of it, and
 * the file's existing rule for a malformed entry is already to drop it.
 */
const MAX_TEXT = 2000;
const MAX_NAME = 120;
const MAX_AFFECTED = 40;

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const fits = (v: unknown, max: number): v is string => isStr(v) && v.length <= max;

/*
 * A day the feed could actually mean: a real one, and not after tomorrow.
 *
 * Only the SHAPE was checked, so `2026-99-99` and `9999-12-31` both passed, and
 * the second is the one that does damage. The list is kept newest-first and cut
 * at MAX_UPDATES, so two hundred entries dated 9999-12-31 hold every place for
 * good. Measured in a real browser: a genuine signed feed published after one
 * such feed was never stored, the install's policy watch was over, and Erase
 * everything kept the poison. The date the cap sorts by has to be one the cap
 * can trust.
 *
 * Real, the way `backup.ts`'s `isISODate` decides it: a string that survives
 * the round trip through a Date. `2026-02-31` has the shape and is 3 March.
 *
 * Not after TOMORROW, on the reader's own calendar. `changedOn` is the day a
 * change was published and `checkedOn` the day a page was read, and neither can
 * be later than the day the feed is read: `feed:add`, the tool that writes the
 * feed, already refuses both in the future ("a promise is not a change"). The
 * one day of slack is time zones — the feed is written in UK days, and no
 * clock on Earth is more than one calendar day behind London's. Anything later
 * is a slip of the keyboard or a feed that means harm, and either way it is
 * not news yet. The bound is deliberately that
 * tight rather than "far" in the future, because whatever it allows is how long
 * one bad feed can crowd out the real ones; at one day, the next day's genuine
 * changes outrank it. A phone whose clock runs slow drops a genuine change
 * rather than keeping it — and fetches it again on every launch, so it arrives
 * once the clock is right, which is the recoverable way round.
 *
 * The same reader checks the DEVICE's copy (`hydrate` comes through here), so
 * an install that took such a feed before this check existed is cleaned at its
 * next launch rather than left stuck.
 */
function plausibleDay(v: unknown, latest: string): v is string {
  if (!isStr(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return toISODate(fromISODate(v)) === v && v <= latest;
}

/**
 * Validate a downloaded feed. It arrives over the network, so nothing in it is
 * trusted: a malformed entry is dropped rather than allowed to reach a screen,
 * and an oversized document is cut down to the newest MAX_UPDATES rather than
 * refused outright — a feed that grew past the cap should still deliver
 * today's change, not go quiet.
 *
 * `from` says where the document came from, and it decides one field: `demo`
 * survives only from the device's own store. From the network it is dropped,
 * because "this is only a sample" is a label that exempts an entry from being
 * taken seriously, and nothing downloaded gets to award itself that.
 */
/** A citation, or nothing: an https page on some host, and the day it was read. */
function readSource(raw: unknown, latest: string): { url: string; checkedOn: string } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!fits(r.url, MAX_TEXT) || !plausibleDay(r.checkedOn, latest)) return undefined;
  try {
    if (new URL(r.url).protocol !== 'https:') return undefined;
  } catch {
    return undefined;
  }
  return { url: r.url, checkedOn: r.checkedOn };
}

export function readFeed(
  doc: unknown,
  from: 'network' | 'device' = 'network',
  today: Date = new Date(),
): PolicyUpdate[] | null {
  if (typeof doc !== 'object' || doc === null) return null;
  const d = doc as Record<string, unknown>;
  if (d.feed !== 'kept-policy' || !Array.isArray(d.updates)) return null;
  const latest = toISODate(addDays(today, 1));

  const out: PolicyUpdate[] = [];
  for (const raw of d.updates) {
    if (typeof raw !== 'object' || raw === null) continue;
    const u = raw as Record<string, unknown>;
    if (!fits(u.id, MAX_NAME) || !fits(u.store, MAX_NAME) || !fits(u.text, MAX_TEXT)) continue;
    if (!plausibleDay(u.changedOn, latest)) continue;
    if (!Array.isArray(u.affectsStores) || u.affectsStores.length > MAX_AFFECTED) continue;
    if (!u.affectsStores.every((x) => fits(x, MAX_NAME))) continue;
    if (
      u.newWindowDays !== undefined &&
      (!Number.isInteger(u.newWindowDays) ||
        (u.newWindowDays as number) < 1 ||
        (u.newWindowDays as number) > MAX_WINDOW_DAYS)
    ) {
      continue;
    }
    const source = readSource(u.source, latest);
    // Downloaded, a change must say where it came from. See `PolicyUpdate.source`.
    if (from === 'network' && !source) continue;
    out.push({
      id: u.id,
      store: u.store,
      changedOn: u.changedOn,
      text: u.text,
      affectsStores: u.affectsStores as string[],
      affectNote: fits(u.affectNote, MAX_TEXT) ? u.affectNote : '',
      ...(u.newWindowDays !== undefined ? { newWindowDays: u.newWindowDays as number } : {}),
      ...(from === 'device' && u.demo === true ? { demo: true } : {}),
      ...(source ? { source } : {}),
    });
  }
  return newestFirst(out);
}
