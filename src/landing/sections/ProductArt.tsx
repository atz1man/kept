import type { CSSProperties, ReactNode } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { CameraGlyph, Tick } from '../../app/components/Icons';

/*
 * The product, drawn in the product's own parts.
 *
 * Each feature row on the landing page is shown with a miniature of the screen
 * that does it — rows, rings, a letter, the scan card — in HTML and the app's
 * tokens rather than as a screenshot. A screenshot is a picture of last
 * month's build; these use the same colours and the same table the app reads,
 * so they move when it does. They are pictures all the same: each one is a
 * single image to a screen reader, named by what it shows, and nothing in one
 * can be focused.
 */

function Figure({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        // The lightest stop is the declared colour, so the contrast sweep
        // measures anything set straight on the ground where it is weakest.
        backgroundColor: color.surfaceAlt, backgroundImage: `linear-gradient(160deg, ${color.accentSoft} 0%, ${color.surfaceAlt} 62%)`,
        borderRadius: radius.hero, padding: 'clamp(22px, 4.5vw, 44px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, minHeight: 340,
        position: 'relative', overflow: 'hidden', ...style,
      }}
    >
      {/* The brand's one graphic device, the countdown ring, as a watermark. */}
      <svg aria-hidden="true" width="260" height="260" viewBox="0 0 260 260" style={{ position: 'absolute', right: -70, top: -80, pointerEvents: 'none' }}>
        <circle cx="130" cy="130" r="100" fill="none" stroke={color.accent} strokeOpacity="0.07" strokeWidth="26" />
        <circle cx="130" cy="130" r="100" fill="none" stroke={color.accent} strokeOpacity="0.14" strokeWidth="26" strokeLinecap="round" strokeDasharray="420 629" transform="rotate(-90 130 130)" />
      </svg>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'inherit' }}>{children}</div>
    </div>
  );
}

const panel: CSSProperties = {
  background: color.surface, borderRadius: radius.card, boxShadow: shadow.raisedLg, padding: '16px 18px',
};

/** A deadline ring, as the receipt list draws one. */
function Ring({ days, of, urgent }: { days: number; of: number; urgent?: boolean }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const ink = urgent ? color.danger : color.accentFigure;
  return (
    <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
      <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
        <circle cx="23" cy="23" r={r} fill="none" stroke={color.rail} strokeWidth="3.5" />
        <circle
          className="k-ring"
          cx="23" cy="23" r={r} fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${(c * Math.max(0.06, days / of)).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 23 23)"
        />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: font.figures, fontWeight: 700, fontSize: 15, color: urgent ? color.danger : color.ink }}>
        {days}
      </span>
    </div>
  );
}

/** Receipt rows with their clocks — what the home screen leads with. */
export function DeadlinesArt({ rows }: { rows: { shop: string; item: string; days: number; of: number; price: string }[] }) {
  return (
    <Figure label={`Receipts listed by deadline, the soonest first: ${rows.map((r) => `${r.shop}, ${r.days} days left`).join('; ')}`}>
      {rows.map((r, i) => (
        <div key={r.shop} style={{ ...panel, display: 'flex', alignItems: 'center', gap: 14, transform: i === 0 ? 'scale(1.02)' : undefined }}>
          <Ring days={r.days} of={r.of} urgent={r.days <= 3} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 650, fontSize: 15, color: color.ink }}>{r.shop}</div>
            <div style={{ fontSize: 13, color: color.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.item}</div>
          </div>
          <div style={{ fontFamily: font.figures, fontWeight: 600, fontSize: 15, color: color.ink }}>{r.price}</div>
        </div>
      ))}
    </Figure>
  );
}

/** The shop's clock and the law's, side by side on one purchase. */
export function TwoClocksArt({ shopDays, lawDays, coolingDays }: { shopDays: number; lawDays: number; coolingDays: number }) {
  const longest = Math.max(shopDays, lawDays, coolingDays);
  const bar = (label: string, sub: string, days: number, fill: string) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
        <span style={{ fontWeight: 600, color: color.ink }}>{label}</span>
        <span style={{ fontFamily: font.figures, fontWeight: 600, color: color.ink }}>{days} days</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: color.surfaceAlt, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${(days / longest) * 100}%`, height: '100%', borderRadius: 999, background: fill }} />
      </div>
      <div style={{ fontSize: 12.5, color: color.muted, marginTop: 6 }}>{sub}</div>
    </div>
  );
  return (
    <Figure label={`One online order with three deadlines: the shop's ${shopDays}-day returns window, the ${coolingDays}-day legal cooling-off period, and ${lawDays} days to reject it if it is faulty`}>
      <div style={{ ...panel, padding: '20px 22px', display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 650, fontSize: 15, color: color.ink }}>Wool coat</div>
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 2 }}>Ordered online</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: color.accentInk, background: color.accentSoft, padding: '5px 10px', borderRadius: radius.pill, whiteSpace: 'nowrap' }}>
            3 clocks running
          </span>
        </div>
        {bar('The shop’s returns window', 'Change of mind, from the shop’s own policy', shopDays, color.accent)}
        {bar('Cooling-off, by law', 'Most online orders, for any reason', coolingDays, color.heroEnd)}
        {bar('Right to reject, by law', 'If it turns out to be faulty', lawDays, color.ink)}
      </div>
    </Figure>
  );
}

/** A letter to the shop, drafted. */
export function LetterArt() {
  return (
    <Figure label="A letter to the shop, drafted for you, quoting the Consumer Rights Act 2015">
      <div style={{ ...panel, padding: '22px 24px 20px', display: 'grid', gap: 10, maxWidth: 430, width: '100%', margin: '0 auto', boxSizing: 'border-box', fontSize: 13.5, lineHeight: 1.55, color: color.body }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: color.muted }}>
          <span style={{ fontWeight: 600 }}>To: Currys customer services</span>
          <span>Draft</span>
        </div>
        <div style={{ color: color.ink, fontWeight: 650 }}>Re: JBL headphones, order 4471-2290</div>
        <div>The left earcup stopped working on day 12. Under the Consumer Rights Act 2015 the goods must be of satisfactory quality.</div>
        <div style={{ background: color.accentSoft, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 650, color: color.accentInk }}>Section 22: the right to reject</div>
          <div style={{ fontSize: 13, color: color.ink, marginTop: 3 }}>As this is within 30 days of delivery, I am rejecting them for a full refund.</div>
        </div>
        <div>Yours faithfully,</div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {['Copy', 'Email it', 'Share'].map((a) => (
          <span key={a} style={{ fontSize: 12.5, fontWeight: 600, color: color.ink, background: color.surface, borderRadius: radius.pill, padding: '7px 14px', boxShadow: shadow.raised }}>{a}</span>
        ))}
      </div>
    </Figure>
  );
}

/** The add screen after a scan: what it read, waiting to be checked. */
export function ScanArt() {
  const field = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${color.borderHair}`, fontSize: 14 }}>
      <span style={{ color: color.muted }}>{label}</span>
      <span style={{ fontWeight: 600, color: color.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {value}
        <Tick size={14} stroke={color.accentFigure} />
      </span>
    </div>
  );
  return (
    <Figure label="A photographed receipt, read on the phone: the shop, the total and the date, shown to be checked before saving">
      <div style={{ ...panel, maxWidth: 400, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: color.accentSoft, display: 'grid', placeItems: 'center' }}>
            <CameraGlyph size={18} stroke={color.accentInk} />
          </span>
          <div>
            <div style={{ fontWeight: 650, fontSize: 14.5, color: color.ink }}>Read from your photo</div>
            <div style={{ fontSize: 12.5, color: color.muted }}>On this phone. Check it, then save.</div>
          </div>
        </div>
        {field('Shop', 'John Lewis')}
        {field('Total', '£129.00')}
        {field('Bought', '24 October')}
        <div style={{ marginTop: 10, background: color.accent, color: color.white, borderRadius: radius.pill, textAlign: 'center', padding: '11px 0', fontWeight: 600, fontSize: 14 }}>
          Save receipt
        </div>
      </div>
    </Figure>
  );
}

/** The small print a shop hides, as cards. */
export function SmallPrintArt({ cards }: { cards: { store: string; days: number; text: string }[] }) {
  return (
    <Figure label={`The small print Quids In already knows: ${cards.map((c) => `${c.store}, ${c.days} days`).join('; ')}`} style={{ gap: 14 }}>
      {cards.map((c, i) => (
        <div key={c.store} style={{ ...panel, marginLeft: i === 1 ? 'clamp(0px, 4vw, 28px)' : 0, marginRight: i === 1 ? 0 : 'clamp(0px, 4vw, 28px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 650, fontSize: 15, color: color.ink }}>{c.store}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: color.accentInk, background: color.accentSoft, padding: '4px 10px', borderRadius: radius.chip, whiteSpace: 'nowrap' }}>{c.days} days</span>
          </div>
          <div style={{ fontSize: 13.5, color: color.body, lineHeight: 1.55, marginTop: 8 }}>{c.text}</div>
        </div>
      ))}
    </Figure>
  );
}

/** Where your data goes: nowhere. Drawn on the hero gradient. */
export function PhoneOnlyArt() {
  const rows = [['ASOS', '2 days', true], ['Currys', '9 days', false], ['IKEA', '301 days', false]] as const;
  return (
    <div
      role="img"
      aria-label="Your receipts stay on your phone; only the list of shop policies comes down to it, and nothing about you goes back"
      style={{ display: 'grid', placeItems: 'center', padding: '12px 0' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 30px)' }}>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          <div style={{ width: 92, padding: '14px 10px', borderRadius: 22, background: color.onHeroChip, border: `1px solid ${color.onHeroGlass}`, display: 'grid', gap: 6, justifyItems: 'center', color: color.white, fontSize: 12.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" stroke={color.gold} strokeWidth="2.2" strokeLinecap="round" /></svg>
            Shop<br />policies
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center', color: color.white, fontSize: 12, fontWeight: 600 }}>
          <span>comes down</span>
          <svg width="80" height="12" viewBox="0 0 80 12" aria-hidden="true">
            <path d="M2 6h72M68 1.5L74.5 6 68 10.5" fill="none" stroke={color.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg width="80" height="12" viewBox="0 0 80 12" aria-hidden="true">
            <path d="M78 6H8M14 1.5L7.5 6 14 10.5" fill="none" stroke={color.white} strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 5" />
            <path d="M34 0L46 12M46 0L34 12" stroke={color.white} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span>nothing goes back</span>
        </div>
        <div style={{ width: 132, padding: 6, borderRadius: 30, background: color.heroTop, border: `2px solid ${color.onHeroGlass}`, boxShadow: '0 20px 40px rgba(42,26,46,0.35)' }}>
          <div style={{ borderRadius: 24, background: color.surface, padding: '18px 8px 12px', display: 'grid', gap: 6 }}>
            <div style={{ width: 34, height: 9, borderRadius: 9, background: color.heroTop, margin: '-10px auto 4px' }} />
            {rows.map(([shop, left, urgent]) => (
              <div key={shop} style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center', background: color.surfaceAlt, borderRadius: 9, padding: '7px 8px', fontSize: 11 }}>
                <span style={{ fontWeight: 650, color: color.ink }}>{shop}</span>
                <span style={{ fontWeight: 650, color: urgent ? color.danger : color.bodyStrong, whiteSpace: 'nowrap' }}>{left}</span>
              </div>
            ))}
            <div style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: color.muted, marginTop: 2 }}>Only on this phone</div>
          </div>
        </div>
      </div>
    </div>
  );
}
