import { useId, useMemo, useState } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { STORE_POLICIES, clockFor, findStore } from '../../lib/stores';
import { firstToCloseLine, LEGAL_DISCLAIMER } from '../../lib/legal';
import { floorWords } from '../../lib/receipts';
import { addDays, fmtDateLong, toISODate, ukDay } from '../../lib/dates';
import { checkProblem, checkReturn } from '../checker';

/*
 * "Can I still return it?" — the product's central claim, live on the page.
 *
 * Everything it says comes from `checkReturn` (../checker.ts), which asks the
 * app's own functions; this file only lays the answer out. The shop list is
 * the table, alphabetised so a name can be found, and the quick picks are the
 * shops whose clocks are least like a till's: a delivery clock, a dispatch
 * clock, a year, a fortnight.
 */
const SHOPS = [...STORE_POLICIES].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
const QUICK_PICKS = ['ASOS', 'Zara', 'Amazon', 'Next', 'IKEA', 'Apple'].filter((n) => findStore(n));

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

function Ring({ left, of, urgent }: { left: number; of: number; urgent: boolean }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const share = of > 0 ? Math.max(0, Math.min(1, left / of)) : 0;
  return (
    <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
      <circle cx="84" cy="84" r={r} fill="none" stroke={color.rail} strokeWidth="12" />
      <circle
        className="k-ring"
        cx="84" cy="84" r={r} fill="none" stroke={urgent ? color.danger : color.accentFigure} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(c * Math.max(share, left >= 0 ? 0.02 : 0)).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 84 84)"
      />
    </svg>
  );
}

export function Checker({ store, onStore }: { store: string; onStore: (s: string) => void }) {
  const id = useId();
  const today = useMemo(() => ukDay(new Date()), []);
  const [online, setOnline] = useState(true);
  const [purchasedOn, setPurchasedOn] = useState(() => toISODate(addDays(ukDay(new Date()), -9)));
  const [startedOn, setStartedOn] = useState('');

  const shop = findStore(store);
  const clock = shop ? clockFor(shop, online) : 'purchase';
  const asksStart = online && clock !== 'purchase';
  const input = { store, purchasedOn, online, startedOn: asksStart && startedOn ? startedOn : undefined };
  const problem = checkProblem(input, today);
  const got = problem === null ? checkReturn(input, today) : null;
  const urgent = got !== null && (got.expired || got.daysLeft <= 3);

  const field = { width: '100%', boxSizing: 'border-box' as const, minHeight: 48, padding: '0 14px', borderRadius: radius.control, border: `1px solid ${color.borderSoft}`, background: color.surface, color: color.ink, fontSize: 16, fontFamily: font.ui };
  const label = { display: 'block', fontSize: 14, fontWeight: 600, color: color.bodyStrong, marginBottom: 8 };

  return (
    <div className="k-checker" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 0, background: color.surface, borderRadius: radius.hero, boxShadow: shadow.raisedLg, overflow: 'hidden', border: `1px solid ${color.borderHair}` }}>
      <form onSubmit={(e) => e.preventDefault()} style={{ padding: 'clamp(22px, 4vw, 40px)', display: 'grid', gap: 22, alignContent: 'start' }}>
        <div>
          <label htmlFor={`${id}-shop`} style={label}>Shop</label>
          <select id={`${id}-shop`} value={store} onChange={(e) => onStore(e.target.value)} style={field}>
            {SHOPS.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
          <div role="group" aria-label="Popular shops" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {QUICK_PICKS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={store === n}
                onClick={() => onStore(n)}
                className="k-pick"
                style={{ minHeight: 36, padding: '0 14px', borderRadius: radius.pill, border: `1px solid ${store === n ? color.accent : color.borderSoft}`, background: store === n ? color.accentSoft : color.surface, color: store === n ? color.accentInk : color.body, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: font.ui }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend style={{ ...label, padding: 0 }}>How did you buy it?</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: color.surfaceAlt, padding: 5, borderRadius: radius.pill }}>
            {[['Online', true], ['In a shop', false]].map(([text, value]) => (
              <label key={String(value)} className="k-seg" style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 42, borderRadius: radius.pill, cursor: 'pointer', fontWeight: 600, fontSize: 15, background: online === value ? color.surface : 'transparent', color: online === value ? color.ink : color.body, boxShadow: online === value ? shadow.raised : undefined }}>
                <input type="radio" name={`${id}-how`} checked={online === value} onChange={() => setOnline(value as boolean)} className="k-sr" />
                {text as string}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${id}-bought`} style={label}>{online ? 'Day you ordered it' : 'Day you bought it'}</label>
          <input id={`${id}-bought`} type="date" value={purchasedOn} max={toISODate(today)} onChange={(e) => setPurchasedOn(e.target.value)} style={field} />
        </div>

        {asksStart && (
          <div>
            <label htmlFor={`${id}-start`} style={label}>
              {clock === 'dispatch' ? 'Day it was dispatched' : 'Day it arrived'} <span style={{ fontWeight: 500, color: color.muted }}>(if you know it)</span>
            </label>
            <input id={`${id}-start`} type="date" value={startedOn} min={purchasedOn} max={toISODate(today)} onChange={(e) => setStartedOn(e.target.value)} style={field} />
            <p style={{ fontSize: 13.5, color: color.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
              {store} counts from {clock}, not from your order.
            </p>
          </div>
        )}
      </form>

      <div aria-live="polite" style={{ background: color.surfaceAlt, padding: 'clamp(22px, 4vw, 40px)', display: 'grid', gap: 18, alignContent: 'start' }}>
        {got === null ? (
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: color.danger }}>{problem}</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 168, height: 168, flexShrink: 0 }}>
                <Ring left={got.daysLeft} of={got.windowDays} urgent={urgent} />
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
                  <span style={{ fontFamily: font.figures, fontVariantNumeric: 'proportional-nums', fontSize: got.expired || got.daysLeft === 0 ? 30 : 46, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: urgent ? color.danger : color.ink }}>
                    {got.expired ? 'Closed' : got.daysLeft === 0 ? 'Today' : got.daysLeft}
                  </span>
                  {!got.expired && got.daysLeft > 0 && <span style={{ fontSize: 14, fontWeight: 600, color: color.muted, marginTop: 4 }}>{got.daysLeft === 1 ? 'day left' : 'days left'}</span>}
                </div>
              </div>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: color.muted }}>
                  {got.shop.name}’s {days(got.windowDays)}, from {got.clock === 'purchase' ? 'the day you bought it' : got.clock}
                </div>
                <div style={{ fontFamily: font.display, fontSize: 'clamp(22px, 2.4vw, 28px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 6, color: color.ink }}>
                  {got.expired
                    ? `The shop’s window closed ${fmtDateLong(got.deadline)}.`
                    : `Last day to return: ${got.floor ? 'no earlier than ' : ''}${fmtDateLong(got.deadline)}`}
                </div>
                {got.floor && (
                  <div style={{ fontSize: 13.5, color: color.body, marginTop: 6, lineHeight: 1.5 }}>
                    It counts from {floorWords(got.clock as 'delivery' | 'dispatch').countsFrom}, so {floorWords(got.clock as 'delivery' | 'dispatch').addIt} for the exact day.
                  </div>
                )}
              </div>
            </div>

            {got.first && (
              <div style={{ background: color.accentSoft, color: color.accentInk, borderRadius: radius.card, padding: '12px 16px', fontSize: 14.5, fontWeight: 600, lineHeight: 1.5 }}>
                {firstToCloseLine(got.first)}
              </div>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {got.rights.map((r) => (
                <li key={r.chip} style={{ background: color.surface, borderRadius: radius.card, padding: '12px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: r.live ? color.accentInk : color.muted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{r.chip}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: color.body, marginTop: 4 }}>{r.body}</div>
                </li>
              ))}
              {got.shop.gotcha && (
                <li style={{ background: color.caution, borderRadius: radius.card, padding: '12px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: color.cautionInk, textTransform: 'uppercase', letterSpacing: '0.02em' }}>The small print</div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: color.cautionInk, marginTop: 4 }}>{got.shop.gotcha}</div>
                </li>
              )}
            </ul>

            <p style={{ fontSize: 13, color: color.muted, margin: 0, lineHeight: 1.55 }}>
              {got.checkedOn
                ? `${got.shop.name}’s window was last checked against its own returns page on ${fmtDateLong(got.checkedOn)}.`
                : `${got.shop.name}’s window has not yet been checked against its own returns page, so trust your receipt over it.`}{' '}
              {LEGAL_DISCLAIMER}
            </p>

            <a className="k-primary" href="/app/" style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', minHeight: 48, padding: '0 24px', borderRadius: 999, background: color.accent, color: color.white, fontWeight: 600, fontSize: 15.5 }}>
              Keep this one counting down
            </a>
          </>
        )}
      </div>
    </div>
  );
}
