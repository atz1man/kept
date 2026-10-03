import { useEffect, useState } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { addDays, fmtDate, fmtDateNear, fromISODate } from '../../lib/dates';
import { money, sumPence } from '../../lib/money';
import { awaitingArrival, bucket, settledRows, coverLine, derive, refundOf, everyReturnInTime, countsAsMoney, stillReturnablePence, timelineDots } from '../../lib/receipts';
import { search, searchStatus, shouldOfferSearch } from '../../lib/search';
import { midSentence } from '../../lib/words';
import { TAGLINE_LEAD } from '../../lib/brand';
import { heroCount, urgency } from '../../lib/urgency';
import type { Receipt } from '../../lib/types';
import { ArrowRight, Logo, LogoDashed, Tick, Wordmark } from '../components/Icons';
import { Pressable } from '../components/Pressable';
import { ReceiptRow } from '../components/ReceiptRow';
import { refundChase } from '../../lib/refund-chase';

interface Props {
  receipts: Receipt[];
  today: Date;
  urgentDays: number;
  policyAlert: string | null;
  /** Receipts a policy change lands on, by id, decided once in App and shared
      by the banner, the tab dot and every row badge so they cannot disagree.
      By id rather than by shop, because a sample change speaks only to a
      sample receipt — see `policyAlertFor`. */
  changedIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
  /** The row swiped left: returned, or for an online order, sent back. */
  onSwipe: (id: string) => void;
  /** An undo bar is up over the tab bar: the list needs the room to scroll its last row clear of it. */
  undoShowing?: boolean;
  /** Settle every closed window on screen as kept, in one tap (undoable). */
  onKeepClosed: (ids: string[]) => void;
  /** Present when the iPhone app should explain its reminders before iOS asks. */
  reminders?: { onYes: () => void; onNo: () => void };
  onAdd: () => void;
  onWatch: () => void;
  /** Takes the five samples off the list, leaving the person's own receipts. */
  onClearSamples: () => void;
}

const sectionLabel = (c: string) => ({
  fontSize: 13, fontWeight: 600, color: c, margin: '22px 4px 8px', letterSpacing: '-0.005em',
});

export function Home({ receipts, today, urgentDays, policyAlert, changedIds, onOpen, onSwipe, onKeepClosed, reminders, onAdd, onWatch, onClearSamples, undoShowing = false }: Props) {
  const [query, setQuery] = useState('');
  const [openReturned, setOpenReturned] = useState(false);
  const [openKept, setOpenKept] = useState(false);
  const offerSearch = shouldOfferSearch(receipts);
  const searching = offerSearch && query.trim().length > 0;
  // Filtered inside the urgency buckets rather than flattened into one list:
  // "which of these is about to close" is the question the grouping answers,
  // and it is still the question while you are looking for something.
  const visible = searching ? search(receipts, query) : receipts;

  const { closed, urgent, later, returned, kept, sent } = bucket(visible, today, urgentDays);
  const active = [...closed, ...urgent, ...later];
  // Whether a sample still counts is decided over EVERY receipt, not the ones
  // a search left visible: the samples stop being money the moment a real
  // receipt exists, whatever is on screen.
  const counts = countsAsMoney(receipts);
  /*
   * The headline is a real receipt once there is one. It took `active[0]`,
   * and the samples sit in the same buckets: somebody who had just saved
   * their first purchase read "£89.00 back if it goes back by…" about
   * Currys headphones nobody bought, and three days later "WINDOW ALREADY
   * CLOSED" over them, above the receipt they actually cared about. A sample
   * still leads while nothing real is live — it says it is one.
   */
  const next = searching ? undefined : (active.find(counts) ?? active[0]);
  const stillReturnable = stillReturnablePence({ closed, urgent, later, returned, kept, sent }, receipts);
  const keptBack = sumPence(returned.filter(counts).map(refundOf));
  const dots = timelineDots(receipts, today);
  const empty = receipts.length === 0;
  // Kept counts as settled: nothing is waiting to go back.
  const allDone = !searching && active.length === 0 && (returned.length > 0 || kept.length > 0 || sent.length > 0);
  const allInTime = everyReturnInTime(returned, today);
  const nothingMatched = searching && visible.length === 0;

  /*
   * Said out loud, after a pause.
   *
   * A polite live region rewritten on every keystroke is ten interruptions of
   * the typing it is reporting on, so the count waits until the typing stops.
   * The region itself is rendered from the moment the box is — a live region
   * that arrives on the page at the same moment as its text is not reliably
   * announced, which is the same reason App's is always mounted.
   */
  const [spokenCount, setSpokenCount] = useState('');
  const matchCount = visible.length;
  useEffect(() => {
    if (!searching) {
      setSpokenCount('');
      return undefined;
    }
    const t = setTimeout(() => setSpokenCount(searchStatus(matchCount, query)), 450);
    return () => clearTimeout(t);
  }, [searching, query, matchCount]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: `6px 16px ${undoShowing ? 212 : 120}px` }}>
      <header className="k-fade" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 2px 16px' }}>
        <h1 tabIndex={-1} style={{ display: 'flex', alignItems: 'center', gap: 9, margin: 0, fontWeight: 400, minWidth: 0 }}>
          <Logo size={28} />
          <span>
            <Wordmark />
            <span style={{ display: 'block', fontSize: 11, fontWeight: 500, letterSpacing: 0, color: color.muted, marginTop: 2 }}>
              {TAGLINE_LEAD}
            </span>
          </span>
        </h1>
        {/* nowrap + no shrink: at 320px this was breaking to "ON-" / "DEVICE".
            The masthead beside it wraps instead, which it does gracefully. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: color.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: color.accent }} />
          On this phone
        </div>
      </header>

      {/* Before iOS asks, which it does once and never again. Worded as
          Settings words the iPhone's reminders — the mechanism and the
          moment, not a promise. */}
      {reminders && (
        <section
          aria-labelledby="reminders-title"
          style={{ background: color.white, border: `1px solid ${color.border}`, borderRadius: radius.card, padding: '16px 16px 14px', marginBottom: 14 }}
        >
          <h2 id="reminders-title" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Reminders for your deadlines</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.5, color: color.bodyStrong }}>
            Kept can lodge each deadline with iOS, so a reminder arrives at 9am on the day, even with Kept shut. iOS
            asks for permission once, so this is what it is for.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <Pressable
              className="k-cta-yellow"
              onClick={reminders.onYes}
              style={{ flex: '1 1 150px', padding: 13, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
            >
              Turn on reminders
            </Pressable>
            <Pressable
              className="k-row-white"
              onClick={reminders.onNo}
              style={{ flex: '1 1 100px', padding: 13, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
            >
              Not now
            </Pressable>
          </div>
        </section>
      )}

      {next && (
        <HeroCard
          receipt={next}
          today={today}
          stillReturnable={money(stillReturnable)}
          keptBack={money(keptBack)}
          onOpen={() => onOpen(next.id)}
        />
      )}

      {/* Once there is a real receipt, the samples are clutter beside it, and
          their only way out was one at a time or Erase everything. Offered
          here, where the clutter is, and not while nothing real exists:
          then the samples ARE the app, showing what it does. */}
      {!searching && receipts.some((r) => !r.demo) && receipts.some((r) => r.demo) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', margin: '14px 2px 4px', fontSize: 13, color: color.muted }}>
          <span style={{ minWidth: 0 }}>Receipts marked sample are ours, not yours.</span>
          <Pressable
            onClick={onClearSamples}
            style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13, fontWeight: 600, color: color.ink, textDecoration: 'underline' }}
          >
            Remove the samples
          </Pressable>
        </div>
      )}

      {offerSearch && (
        <div style={{ margin: '0 2px 4px' }}>
          <label htmlFor="receipt-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Search your receipts
          </label>
          <input
            id="receipt-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shop or item"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: radius.control,
              border: `1px solid ${color.border}`, background: color.white,
              fontFamily: font.ui, fontSize: 14.5, color: color.ink,
            }}
          />
          <div className="k-sr" role="status" aria-live="polite">{spokenCount}</div>
        </div>
      )}

      {policyAlert && !searching && (
        <Pressable
          className="k-banner k-fade"
          onClick={onWatch}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, background: color.white,
            border: `1px solid ${color.borderHair}`, borderRadius: radius.card, padding: '12px 14px', marginTop: 10,
          }}
        >
          <span className="k-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: color.accent, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.4, textAlign: 'left', color: color.bodyStrong }}>{policyAlert}</span>
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, color: color.muted }}>›</span>
        </Pressable>
      )}

      {next && (
        <section className="k-fade" style={{ margin: '18px 2px 0' }} aria-label="Deadlines in the next 30 days">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: color.muted, letterSpacing: 0 }}>
            <span>Next 30 days</span>
            <span style={{ fontFamily: font.figures }}>today → {fmtDate(addDays(today, 30))}</span>
          </div>
          <div style={{ position: 'relative', height: 22, marginTop: 8 }}>
            <div style={{ position: 'absolute', top: 10.5, left: 0, right: 0, height: 1, background: color.rail }} />
            {dots.map((d, i) => (
              <div
                key={`${d.store}-${i}`}
                title={`${d.store} · ${d.daysLeft} days left`}
                style={{
                  position: 'absolute', top: 6, left: `${d.left}%`, width: 10, height: 10,
                  marginLeft: -5, borderRadius: 999, background: urgency(d.daysLeft, urgentDays).dot,
                  border: `2px solid ${color.canvas}`, boxSizing: 'content-box',
                }}
              />
            ))}
          </div>
        </section>
      )}

      {empty && <EmptyState onAdd={onAdd} />}

      {nothingMatched && (
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px' }}>
            Nothing matches “{query.trim()}”
          </div>
          <div style={{ fontSize: 14, color: color.muted, lineHeight: 1.6, marginTop: 8 }}>
            Try the shop’s name, or what the thing was.
          </div>
        </div>
      )}

      {allDone && (
        <div style={{ textAlign: 'center', padding: '36px 24px 8px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: color.accentSoft, border: `1px solid ${color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Tick size={26} />
          </div>
          <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>All squared away</div>
          {/* "Every return made it back in time" was unconditional, and a
              return can be made after the shop's window shuts — by goodwill,
              or the faulty-goods route, which is the harder one. Same fault
              the celebrate card had: a claim about timing that nothing
              checked. Said only when it is true; the money is true either
              way. */}
          <div style={{ fontSize: 14, color: color.muted, lineHeight: 1.6, marginTop: 8 }}>
            {returned.length > 0
              ? `${allInTime ? 'Every return made it back in time. ' : ''}${money(keptBack)} recovered — not bad.`
              : 'Nothing is waiting to go back.'}
          </div>
        </div>
      )}

      {/* Above "go now or lose it", because these are already lost and the
          heading below cannot be done about them — but still at the top,
          because the money may be recoverable under the statutory rights and
          this is the row a person most needs to see. */}
      {closed.length > 0 && (
        <>
          <h2 style={sectionLabel(color.danger)}>Window closed · check your rights</h2>
          <ul className="k-group">
            {closed.map((r) => (
              <ReceiptRow
                key={r.id}
                receipt={r}
                onItsWay={awaitingArrival(r, today)}
                urgency={urgency(derive(r, today).daysLeft, urgentDays)}
                emphasised
                policyChanged={changedIds.has(r.id)}
                onOpen={() => onOpen(r.id)}
                onSwipe={() => onSwipe(r.id)}
              />
            ))}
          </ul>
          {/* The way out of the backlog. Not offered mid-search: a tap that
              settles "these" should settle what the section holds, not
              whatever a half-typed query happened to leave in it. */}
          {!searching && (
            <Pressable
              className="k-row-white"
              onClick={() => onKeepClosed(closed.map((r) => r.id))}
              style={{ marginTop: 9, padding: 13, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
            >
              {closed.length === 1 ? 'I’m keeping it' : `I’m keeping all ${closed.length}`}
            </Pressable>
          )}
        </>
      )}

      {urgent.length > 0 && (
        <>
          <h2 style={sectionLabel(color.danger)}>Due soon</h2>
          <ul className="k-group">
            {urgent.map((r) => (
              <ReceiptRow
                key={r.id}
                receipt={r}
                onItsWay={awaitingArrival(r, today)}
                urgency={urgency(derive(r, today).daysLeft, urgentDays)}
                emphasised
                policyChanged={changedIds.has(r.id)}
                onOpen={() => onOpen(r.id)}
                onSwipe={() => onSwipe(r.id)}
              />
            ))}
          </ul>
        </>
      )}

      {later.length > 0 && (
        <>
          <h2 style={sectionLabel(color.muted)}>Later</h2>
          <ul className="k-group">
            {later.map((r) => (
              <ReceiptRow
                key={r.id}
                receipt={r}
                onItsWay={awaitingArrival(r, today)}
                urgency={urgency(derive(r, today).daysLeft, urgentDays)}
                emphasised={false}
                policyChanged={changedIds.has(r.id)}
                onOpen={() => onOpen(r.id)}
                onSwipe={() => onSwipe(r.id)}
              />
            ))}
          </ul>
        </>
      )}

      {sent.length > 0 && (
        <>
          {/* In between: gone back, the money not yet seen. Out of the
              deadlines (the parcel is in the post), not yet in the total. */}
          <h2 style={sectionLabel(color.muted)}>Sent back · waiting for the refund</h2>
          <ul className="k-group">
            {/* A refund that is late comes first and says so: the list is where
                a chase starts, and the oldest parcel was otherwise the last row. */}
            {[...sent.filter((r) => refundChase(r, today)?.late), ...sent.filter((r) => !refundChase(r, today)?.late)].map((r) => {
              const went = r.sentOn ? `sent back ${fmtDateNear(fromISODate(r.sentOn), today)}` : 'sent back';
              const late = !!refundChase(r, today)?.late;
              return (
                <li key={r.id} style={{ listStyle: 'none' }}>
                  <Pressable
                    onClick={() => onOpen(r.id)}
                    aria-label={`${r.store}, ${r.item}${r.demo ? ' (sample)' : ''}, ${money(r.amount)}, ${went}, ${late ? 'refund late' : 'waiting for the refund'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 15, background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.card }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: color.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.store}</div>
                      <div style={{ fontSize: 12, color: color.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.demo && <span>sample · </span>}
                        {r.item}
                      </div>
                      <div style={{ fontSize: 12, color: color.muted, marginTop: 2 }}>
                        {went}
                        {late && <span style={{ color: color.danger, fontWeight: 600 }}> · refund late</span>}
                      </div>
                    </div>
                    <div style={{ fontFamily: font.figures, fontSize: 15, fontWeight: 600, color: color.body, flexShrink: 0 }}>{money(r.amount)}</div>
                  </Pressable>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {returned.length > 0 && (
        <>
          <h2 style={sectionLabel(color.muted)}>Money back ✓</h2>
          <ul id="money-back-list" className="k-group">
            {settledRows(returned, openReturned, searching).rows.map((r) => (
              <li key={r.id} style={{ listStyle: 'none' }}>
                {/* Reachable. These were inert, so a receipt marked returned by
                    a stray swipe could never be opened, corrected or deleted. */}
                <Pressable
                  onClick={() => onOpen(r.id)}
                  aria-label={`${r.store}, ${r.item}${r.demo ? ' (sample)' : ''}, ${r.exchanged ? 'swapped for another' : `${money(refundOf(r))} ${r.credit ? 'in credit' : 'back'}, returned`}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 15, background: color.surfaceAlt, border: '1px solid rgba(20,22,26,0.06)', borderRadius: radius.card }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: color.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Tick />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, textDecoration: 'line-through', color: color.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.store}</div>
                    {/* The marker survives the return. This list is where
                        "which of these were mine" is asked, and the row
                        stopped saying so the moment it was ticked off — these
                        rows are hand-built rather than a ReceiptRow, so the
                        marker added there never reached them. */}
                    <div style={{ fontSize: 12, color: color.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.demo && <span>sample · </span>}
                      {r.item}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {/* A swap brought an item back, not money: said, not shown as £0.00. */}
                    <div style={{ fontFamily: font.figures, fontSize: 15, fontWeight: 600, color: color.accentInk }}>{r.exchanged ? 'swapped' : money(refundOf(r))}</div>
                    {/* Credit is not cash: it is still at the shop, to be spent. */}
                    {r.credit && <div style={{ fontSize: 11, fontWeight: 600, color: color.muted, marginTop: 2 }}>credit</div>}
                  </div>
                </Pressable>
              </li>
            ))}
          </ul>
          <ShowAll list="money-back-list" total={returned.length} hidden={settledRows(returned, openReturned, searching).hidden} open={openReturned} onToggle={() => setOpenReturned((v) => !v)} />
        </>
      )}

      {kept.length > 0 && (
        <>
          {/* Settled, not lost: no reminders, and not in red. Still one tap
              from its warranty, its photo and the rights that outlast the
              shop's window, which is why it is kept here rather than deleted. */}
          <h2 style={sectionLabel(color.muted)}>Keeping</h2>
          <ul id="keeping-list" className="k-group">
            {settledRows(kept, openKept, searching).rows.map((r) => {
              const cover = coverLine(r, today);
              return (
              <li key={r.id} style={{ listStyle: 'none' }}>
                <Pressable
                  onClick={() => onOpen(r.id)}
                  aria-label={`${r.store}, ${r.item}${r.demo ? ' (sample)' : ''}, ${money(r.amount)}, ${cover ? `${cover}, ` : ''}keeping it`}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 15, background: color.surfaceAlt, border: '1px solid rgba(20,22,26,0.06)', borderRadius: radius.card }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: color.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.store}</div>
                    <div style={{ fontSize: 12, color: color.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.demo && <span>sample · </span>}
                      {r.item}
                    </div>
                    {cover && <div style={{ fontSize: 12, color: color.muted, marginTop: 2 }}>{cover}</div>}
                  </div>
                  <div style={{ fontFamily: font.figures, fontSize: 15, fontWeight: 600, color: color.muted, flexShrink: 0 }}>{money(r.amount)}</div>
                </Pressable>
              </li>
              );
            })}
          </ul>
          <ShowAll list="keeping-list" total={kept.length} hidden={settledRows(kept, openKept, searching).hidden} open={openKept} onToggle={() => setOpenKept((v) => !v)} />
        </>
      )}
    </div>
  );
}

/**
 * The way to the rest of a settled section, and back. Rendered only where
 * something is, or was, held back — never under a list that fits.
 */
function ShowAll({ list, total, hidden, open, onToggle }: { list: string; total: number; hidden: number; open: boolean; onToggle: () => void }) {
  if (!open && hidden === 0) return null;
  return (
    <Pressable
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={list}
      style={{ display: 'flex', width: 'auto', minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4, fontSize: 13.5, fontWeight: 600, color: color.bodyStrong, textDecoration: 'underline' }}
    >
      {open ? 'Show fewer' : `Show all ${total}`}
    </Pressable>
  );
}

function HeroCard({ receipt, today, stillReturnable, keptBack, onOpen }: {
  receipt: Receipt; today: Date; stillReturnable: string; keptBack: string; onOpen: () => void;
}) {
  const d = derive(receipt, today);
  const { count, word } = heroCount(d.daysLeft);
  const accent = d.daysLeft <= 3 ? color.danger : color.ink;
  /*
   * The two lines around the headline used to contradict it.
   *
   * On a library with a backlog, the most urgent active receipt is an EXPIRED
   * one — deliberately, because `bucket` keeps it at the top rather than
   * hiding the row a person most needs to see. The headline knew: "Gone — the
   * window closed on your Towels". The label above it still said NEXT WINDOW
   * TO CLOSE, and the line below it still said "£193.25 back if it goes back
   * by 21 Mar", a date five months past. Three statements, one screen, and
   * two of them false.
   */
  const closed = d.daysLeft < 0;

  return (
    <Pressable
      className="k-fade"
      onClick={onOpen}
      style={{
        // A white card on the page, not the ink slab it was: the number and
        // the date carry the urgency, in red when it is close.
        background: color.white, borderRadius: radius.hero, padding: '18px 18px 14px',
        position: 'relative', overflow: 'hidden', color: color.ink, border: `1px solid ${color.borderHair}`,
        boxShadow: shadow.raised, textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: d.daysLeft <= 3 ? color.dangerDot : color.accent }} />
        <span style={{ fontSize: 12.5, color: color.muted, fontWeight: 500 }}>
          {closed ? 'Window closed' : 'Next to close'}
        </span>
      </div>
      {/* No wrap: the count and the sentence share a baseline, and the
          sentence wraps inside its own column rather than dropping below a
          44px number and leaving it stranded on a line of its own. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <span style={{ fontFamily: font.figures, fontSize: 38, fontWeight: 600, letterSpacing: '-0.04em', color: accent, lineHeight: 1, flexShrink: 0 }}>
          {count}
        </span>
        <span style={{ fontSize: 15, fontWeight: 500, color: color.bodyStrong, lineHeight: 1.35 }}>
          {word} {midSentence(receipt.item)}
        </span>
      </div>
      <div style={{ fontSize: 13, color: color.muted, marginTop: 8, lineHeight: 1.45 }}>
        {/* As every row says it: a figure about a purchase nobody made is labelled. */}
        {receipt.demo && 'Sample · '}
        {closed
          ? `${receipt.store} · the shop’s window shut on ${fmtDateNear(d.deadline, today)} — your legal rights may not have`
          : `${receipt.store} · ${money(receipt.amount)} back if it goes back by ${fmtDateNear(d.deadline, today)}`}
      </div>
      {/* The way forward as a quiet line of its own, not a slab of colour:
          the whole card is the button, and the number already says how
          urgent it is. */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, color: color.accentInk, fontWeight: 600, fontSize: 14 }}>
        See what to do <ArrowRight stroke={color.accentInk} />
      </div>
      <div style={{ borderTop: `1px solid ${color.borderHair}`, marginTop: 14, paddingTop: 11, display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: font.figures, fontSize: 12.5 }}>
        <span style={{ color: color.muted }}>{stillReturnable} still returnable</span>
        <span style={{ color: color.accentInk, fontWeight: 600 }}>{keptBack} kept back</span>
      </div>
    </Pressable>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '44px 24px 30px' }}>
      <LogoDashed />
      <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>Nothing tracked yet</div>
      <div style={{ fontSize: 14, color: color.muted, lineHeight: 1.6, marginTop: 8 }}>
        Bought something this week? The return clock is already ticking. Add your first receipt and kept takes it from there.
      </div>
      <Pressable
        className="k-cta-yellow"
        onClick={onAdd}
        style={{
          display: 'inline-block', width: 'auto', marginTop: 18, padding: '14px 28px', background: color.accent, color: color.white,
          border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 14, boxShadow: shadow.raised,
        }}
      >
        Add your first receipt
      </Pressable>
    </div>
  );
}
