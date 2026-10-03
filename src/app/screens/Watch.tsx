import { color, radius } from '../../tokens';
import { daysBetween, fmtDate, fmtDateLong, fromISODate, relativeAgo } from '../../lib/dates';
import { COMING_UP_DAYS, comingUp } from '../../lib/coming-up';
import { Pressable } from '../components/Pressable';
import { assess } from '../../lib/policy-feed';
import type { PolicyUpdate, Receipt } from '../../lib/types';

interface Props {
  updates: PolicyUpdate[];
  receipts: Receipt[];
  today: Date;
  /** The Settings switch. It decides whether anything is fetched at all. */
  watching: boolean;
  onOpen: (id: string) => void;
}

/**
 * The policy feed. Whether an update "affects you" is decided here against
 * the receipts actually held, not baked into the update: the same downloaded
 * item is a headline for one person and an alarm for another, and only the
 * device knows which.
 */
const sectionLabel = { fontSize: 13, fontWeight: 600, color: color.muted, margin: '20px 4px 10px' } as const;

/** "currys.co.uk" from the full address — the part a person recognises. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\d?\./, '');
  } catch {
    return url;
  }
}

export function Watch({ updates, receipts, today, watching, onOpen }: Props) {
  const ahead = comingUp(receipts, today);
  const byId = new Map(receipts.map((r) => [r.id, r]));
  const assessed = assess(updates, receipts, today);
  const onlySamples = updates.length > 0 && updates.every((u) => u.demo);

  return (
    // tabIndex on a scroll container looks odd until you notice this screen
    // has nothing focusable in it: every other screen holds buttons or inputs,
    // so tabbing through them scrolls the region as a side effect. Here there
    // is nothing to tab to, and a keyboard user could not scroll the feed at
    // all. The role and label keep it announced as a place rather than an
    // unexplained stop on the tab order.
    <div
      className="k-fade"
      tabIndex={0}
      role="region"
      aria-label="Coming up and policy changes"
      style={{ flex: 1, overflow: 'auto', padding: '6px 16px 120px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px 4px' }}>
        <span className="k-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: color.accent }} />
        <h1 tabIndex={-1} style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Watch</h1>
      </div>

      {/* Every dated thing ahead, across every receipt, in one list. Each date
          was already on its own receipt's screen; nothing put them side by
          side, so "what do I have to do this month?" meant opening each one.
          And it is this tab's first content from day one: the policy feed
          below is samples until a real change is published. */}
      <h2 style={sectionLabel}>Coming up</h2>
      {ahead.length === 0 ? (
        <p style={{ fontSize: 13.5, color: color.muted, margin: '0 2px', lineHeight: 1.5 }}>
          Nothing dated in the next {COMING_UP_DAYS} days.
        </p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0 }}>
          {ahead.map((c) => {
            const r = byId.get(c.receiptId)!;
            const n = daysBetween(today, c.date);
            const when = n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
            return (
              <li key={`${c.receiptId}:${c.kind}`} style={{ listStyle: 'none' }}>
                <Pressable
                  onClick={() => onOpen(c.receiptId)}
                  aria-label={`${fmtDate(c.date)}, ${when}: ${c.what}. ${r.store}, ${r.item}${c.demo ? ' (sample)' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: color.white,
                    border: `1.5px solid ${n <= 3 ? color.ink : color.border}`, borderRadius: radius.card, textAlign: 'left',
                  }}
                >
                  <span style={{ width: 52, flexShrink: 0, textAlign: 'center' }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{fmtDate(c.date)}</span>
                    <span style={{ display: 'block', fontSize: 11, color: n <= 3 ? color.danger : color.muted, fontWeight: 600, marginTop: 2 }}>{when}</span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: color.bodyStrong }}>{c.what}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: color.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.demo && 'sample · '}
                      {r.store} · {r.item}
                    </span>
                  </span>
                </Pressable>
              </li>
            );
          })}
        </ul>
      )}

      <h2 style={sectionLabel}>Policy changes</h2>
      <p style={{ fontSize: 13, color: color.muted, padding: '0 2px 12px', margin: 0 }}>
        Shops rewrite the rules quietly. You hear about it first — and every receipt you hold is checked against
        the change.
      </p>

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0 }}>
        {assessed.map(({ update: u, impacts, affectsYou }) => {
          return (
            <li
              key={u.id}
              style={{
                listStyle: 'none', background: color.white,
                border: `1.5px solid ${affectsYou ? color.ink : color.border}`,
                borderRadius: radius.card, padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15.5 }}>{u.store}</span>
                {/* A sample carries no date. "2d ago" on an invented change is
                    the freshness claim that made it read as news; the sample
                    receipts say "sample" where it can be seen, and so do these. */}
                <span style={{ fontSize: 10.5, fontWeight: 700, background: color.accentSoft, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {u.demo ? 'sample' : relativeAgo(fromISODate(u.changedOn), today)}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: color.body, lineHeight: 1.55, marginTop: 8 }}>{u.text}</div>
              {/* Where it was read, so it can be checked: every downloaded
                  change must carry this, and a claim about a named shop that
                  cannot be traced to the shop's own page is not published. */}
              {u.source && (
                <a
                  href={u.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 12, fontWeight: 600, color: color.ink }}
                >
                  Read on {hostOf(u.source.url)}, {fmtDateLong(fromISODate(u.source.checkedOn))}
                </a>
              )}
              {affectsYou && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1.5px dashed ${color.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: color.accentInk }}>Affects your receipts</div>
                  {/* Per receipt, not one line for the shop: what a change means
                      depends on the terms each purchase was made under. */}
                  {impacts.map((i) => (
                    <div key={i.receipt.id} style={{ fontSize: 12.5, color: color.muted, marginTop: 4 }}>
                      <span style={{ fontWeight: 700, color: color.bodyStrong }}>{i.receipt.item}</span> — {i.note}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {onlySamples && (
        <p style={{ fontSize: 12.5, color: color.body, textAlign: 'center', marginTop: 16, lineHeight: 1.55 }}>
          These are samples, showing how a change lands on your receipts. No real change has been published yet —
          the first one replaces them.
        </p>
      )}

      <p style={{ fontSize: 11, color: color.muted, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        {/* It said "Policies verified daily by kept · last check today 06:00".
            Nothing verifies daily and nothing recorded a check time — the hour
            was invented. What is true is where the list comes from and when it
            is fetched, which is worth saying and is checkable.

            And it follows the switch. "Fetched each time you open the app" was
            printed whether or not policy watch was on — a sentence that became
            false the moment the switch in Settings started actually stopping
            the fetch, which it now does. */}
        {watching
          ? 'Kept’s own list of changes, fetched each time you open the app'
          : 'Kept’s own list of changes. Policy watch is off, so this is what was already on your device.'}
        <br />
        The whole list downloads, never a query naming your shops — receipts never leave your phone.
      </p>
    </div>
  );
}
