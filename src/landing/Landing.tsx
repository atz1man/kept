import { color, font, shadow, radius } from '../tokens';
import { Logo, Wordmark } from '../app/components/Icons';
import { UNLOCK } from '../lib/pricing';
import { FREE_TIER_LIMIT } from '../lib/quota';
import { STORE_COUNT, findStore } from '../lib/stores';
import { COOLING_OFF_DAYS, REJECT_DAYS } from '../lib/legal';
import { TAGLINE, TAGLINE_LEAD } from '../lib/brand';
import { tickerLines } from './ticker';
import { FinePrintArt, HaulArt, LostReceiptsArt } from './sections/ProblemArt';
import { Card, Eyebrow, OpenAppButton, SectionTitle, WRAP } from './sections/primitives';

/*
 * Every grid below uses `minmax(min(Npx, 100%), 1fr)` rather than a bare
 * `minmax(Npx, 1fr)`. The bare form sets a HARD floor: on a 320px phone a
 * 340px track is wider than the content box, and the entire page scrolls
 * sideways — 48px of it, on the hero. The min() lets the floor collapse to
 * the space that actually exists. scripts/layout.mjs fails the build if it
 * comes back.
 */
const PROBLEMS = [
  { art: <HaulArt />, title: 'The haul is the easy part', body: 'Five shops, one afternoon, five different return clocks — all already ticking.' },
  { art: <LostReceiptsArt />, title: 'Receipts go to die', body: 'Jacket pockets, kitchen drawers, a 9,000-email inbox. Proof of purchase, permanently lost.' },
  { art: <FinePrintArt />, title: 'Nobody reads clause 14b', body: '“30 days from dispatch, unworn, tags attached, exclusions apply.” Kept reads it so you never have to.' },
];

/**
 * The small print this page shows is the table's, not news.
 *
 * These cards used to be the three newest policy CHANGES, read from the seed
 * so they could not drift from the feed — which held them to the wrong thing.
 * The seed's changes are samples nobody had checked against the retailers, and
 * the served feed that matched them called itself "verified". On this page
 * they read as reporting: "ASOS — updated 1 week ago: new 28-day window for
 * frequent returners", about a named company, with a freshness stamp computed
 * from whatever day the page was opened.
 *
 * What kept does know is its own table — the windows and gotchas the README's
 * pre-ship pass checks against each retailer's terms. So the cards show that,
 * read from `stores.ts`, and the section says what policy watch does without
 * pretending anything has been published through it yet.
 */
const TICKER = tickerLines();

const SMALL_PRINT = ['Zara', 'Uniqlo', 'ASOS'].map((name, i) => {
  const s = findStore(name);
  return { store: name, days: s?.windowDays ?? 0, text: s?.gotcha ?? '', emphasised: i === 0 };
});

/**
 * The three windows this page names are the table's, not a second copy of it.
 *
 * They were literals — "IKEA's 365 days, Boots' 35, Apple's 14" — beside a
 * `stores.ts` that owns those numbers, and the README's own pre-ship task is
 * to check all twenty against each retailer's published terms. Whoever does
 * that changes the table; without this they would leave the shop window
 * quoting the old figure, on the page whose whole claim is that Kept knows the
 * real one.
 */
const days = (name: string) => findStore(name)?.windowDays ?? 0;

const WHY: { n: string; title: string; body: string; link?: { href: string; label: string } }[] = [
  { n: '01', title: 'Knows the real policies', body: `IKEA’s ${days('IKEA')} days, Boots’ ${days('Boots')}, Apple’s ${days('Apple')} — Kept’s own list of windows for ${STORE_COUNT} major UK retailers, plus the gotchas: Zara’s clock starts at dispatch, Uniqlo won’t refund online orders in store.` },
  // The two numbers the whole legal half of the product turns on, taken from
  // the module that computes them rather than typed again here. They were
  // prose, beside three shop windows that had already been made derived for
  // exactly this reason.
  { n: '02', title: 'Knows your legal rights', body: `The Consumer Rights Act gives you ${REJECT_DAYS} days to reject faulty goods for a full refund, and online orders carry a ${COOLING_OFF_DAYS}-day cooling-off by law. Kept shows the legal deadline beside the shop’s own.`, link: { href: '/rights/', label: 'What the law gives you →' } },
  // Scanning is read on the phone and never uploaded, and it never saves by
  // itself: what it read is shown to be checked first, because OCR on a
  // creased thermal slip is not always right. The copy says so.
  { n: '03', title: 'Paste or scan, done', body: 'Paste an order email, or photograph a till receipt, and Kept reads the store, total and date on your phone and sets the deadline. You check what it read before anything is saved.' },
  { n: '04', title: 'When it breaks', body: 'Put a warranty length on a receipt and Kept counts it down beside the return window. If something goes wrong, it says what the law gives you that day — a refund, or a free repair — and drafts the letter to the shop, with the right section of the Consumer Rights Act in it.' },
  // "No server" was the loose word — the app is served from one and downloads
  // the policy feed from it on every launch. Naming the one call, and its
  // direction, is a better privacy claim than denying it.
  { n: '05', title: 'Private by design', body: 'Everything lives on your phone. No account, nothing uploaded, no one reading your purchases. Policy updates download to you; nothing about you goes back. Export a backup anytime.' },
  // "a heads-up when something must go back this week" implied a background
  // service. See notify.ts: a web app cannot wake itself, and the onboarding
  // was corrected for this exact claim while these two lines kept making it.
  { n: '06', title: 'Deadline alerts', body: 'A clear countdown on every item, works offline, and an alert the moment you open kept with something due this week. No background service, because a web app cannot wake itself — so it checks every time you come back.' },
];

/**
 * The selling copy is this page's own; the price comes from lib/pricing.ts,
 * which Settings and the add screen read too. A price that says one thing on
 * the page someone bought from and another inside the product is not a
 * cosmetic drift.
 */
const PLANS = [
  { name: 'Free', price: '£0', suffix: '', lines: [`Your first ${FREE_TIER_LIMIT} receipts`, 'Every shop, every deadline'], featured: false },
  { name: 'Unlimited', price: UNLOCK.price, suffix: UNLOCK.suffix, lines: ['Unlimited receipts, for good', 'One payment, no subscription'], featured: true },
];

export function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: color.canvas }}>
      <header style={{ ...WRAP, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label="kept home">
          <Logo size={30} />
          <Wordmark />
        </a>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 14.5, fontWeight: 600, flexWrap: 'wrap' }}>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a className="k-primary" href="/app/" style={{ display: 'flex', alignItems: 'center', gap: 8, background: color.accent, color: color.white, padding: '10px 20px', borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}>
            Open kept
          </a>
        </nav>
      </header>

      <main>
      {/* Hero */}
      <section style={{ ...WRAP, padding: '48px 28px 72px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 56, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${color.border}`, borderRadius: radius.chip, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: color.bodyStrong, background: color.white, marginBottom: 26, flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: color.accent, flexShrink: 0 }} />
            No account · no cloud · no one sees your receipts
          </div>
          <h1 style={{ fontFamily: font.display, fontSize: 'clamp(38px, 5.4vw, 58px)', fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.03em', margin: 0 }}>
            Know every return deadline before it passes.
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.6, color: color.body, maxWidth: 520, margin: '24px 0 0' }}>
            Kept remembers every receipt, knows each shop’s real return policy and your legal rights — and shows you what is about to run out the moment you open it.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
            <OpenAppButton />
            <div style={{ fontSize: 13.5, color: color.muted, lineHeight: 1.5 }}>
              Free for your first {FREE_TIER_LIMIT} receipts.
              <br />
              No account needed.
            </div>
          </div>
          {/* One source with the footer below and with Settings — see
              lib/brand.ts for what it used to say and why it does not. */}
          <div style={{ marginTop: 22, fontSize: 14, fontWeight: 600, color: color.accentInk }}>
            {TAGLINE_LEAD}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
            <span className="k-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: color.accent }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: color.bodyStrong }}>
              Live demo — try it
            </span>
          </div>
          {/*
            The real app, not a video: it is the same build served from /app/,
            so the demo cannot drift from the product the way a recording does.
            Onboarding is skipped for the embed via the query flag.
          */}
          <div style={{ borderRadius: 32, overflow: 'hidden', border: `1px solid ${color.border}`, boxShadow: shadow.lift, background: color.canvas, margin: '0 auto', maxWidth: 402 }}>
            <iframe
              src="/app/?embed=1"
              title="kept — live app demo"
              loading="lazy"
              style={{ width: '100%', height: 812, border: 0, display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div style={{ background: color.white, borderTop: `1px solid ${color.borderHair}`, borderBottom: `1px solid ${color.borderHair}`, padding: '14px 0', overflow: 'hidden', whiteSpace: 'nowrap' }} aria-hidden="true">
        <div className="k-ticker" style={{ display: 'inline-flex', gap: 48, fontSize: 13.5, fontWeight: 500, color: color.body }}>
          {[...TICKER, ...TICKER].map((line, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 48 }}>
              <span>{line}</span>
              <span style={{ color: color.muted }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* The problem */}
      <section style={{ ...WRAP, padding: '80px 28px 0' }}>
        <Eyebrow>The problem</Eyebrow>
        <SectionTitle>You shop in seconds. The fine print takes hours.</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 18, margin: '38px 0 80px' }}>
          {PROBLEMS.map((p) => (
            <Card key={p.title} style={{ overflow: 'hidden' }}>
              <div style={{ height: 220 }}>{p.art}</div>
              <div style={{ padding: '20px 22px' }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{p.title}</div>
                <div style={{ fontSize: 14, color: color.body, lineHeight: 1.6, marginTop: 6 }}>{p.body}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Policy watch */}
      <section style={{ ...WRAP }}>
        <Eyebrow>Policy watch</Eyebrow>
        <SectionTitle>Shops rewrite the rules quietly. kept checks your receipts when they do.</SectionTitle>
        <p style={{ fontSize: 16, color: color.muted, margin: '14px 0 0', maxWidth: 560, lineHeight: 1.6 }}>
          Retailers change return windows and never send a memo. When one does, kept’s list changes and every
          receipt you hold is checked against it. A purchase keeps the terms it was made under; you just find out
          when the shop moves the goalposts for the next one. And the small print is already in there:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 18, margin: '38px 0 80px' }}>
          {SMALL_PRINT.map((u) => (
            <Card key={u.store} emphasised={u.emphasised} style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{u.store}</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: color.accentSoft, padding: '4px 10px', borderRadius: radius.chip, whiteSpace: 'nowrap' }}>{u.days} days</span>
              </div>
              <div style={{ fontSize: 14, color: color.body, lineHeight: 1.6, marginTop: 12 }}>{u.text}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* Why kept */}
      <section id="how" style={{ background: color.white, borderTop: `1px solid ${color.borderHair}`, borderBottom: `1px solid ${color.borderHair}`, padding: '80px 28px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Eyebrow>Why Kept</Eyebrow>
          <SectionTitle maxWidth={640}>The shop’s clock, the law’s clock, and yours — on one screen.</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 1, background: color.borderHair, border: `1px solid ${color.borderHair}`, borderRadius: 14, overflow: 'hidden', marginTop: 44 }}>
            {WHY.map((w) => (
              <div key={w.n} style={{ background: color.white, padding: '30px 28px' }}>
                <div style={{ fontFamily: font.figures, fontSize: 15, fontWeight: 600, color: color.accentInk }}>{w.n}</div>
                <div style={{ fontWeight: 600, fontSize: 17, marginTop: 14 }}>{w.title}</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: color.body, marginTop: 8 }}>{w.body}</div>
                {w.link && (
                  <a href={w.link.href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 4, fontSize: 14, fontWeight: 600, color: color.accentInk }}>
                    {w.link.label}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ ...WRAP, padding: '80px 28px' }}>
        <div style={{ textAlign: 'center' }}>
          <Eyebrow>Pricing</Eyebrow>
          <h2 style={{ fontFamily: font.display, fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 600, letterSpacing: '-0.03em', margin: '14px 0 0' }}>
            Free for your first {FREE_TIER_LIMIT} receipts.
          </h2>
          <p style={{ fontSize: 16, color: color.muted, margin: '12px 0 0' }}>Then {UNLOCK.price}, once, for unlimited. No subscription.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 20, maxWidth: 600, margin: '44px auto 0' }}>
          {PLANS.map((t) =>
            t.featured ? (
              <div key={t.name} style={{ background: color.white, borderRadius: 14, padding: '30px 26px', position: 'relative', border: `1px solid ${color.accent}`, boxShadow: shadow.raisedLg }}>
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: color.accent, color: color.white, fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: radius.chip, letterSpacing: 0, whiteSpace: 'nowrap' }}>
                  Pay once
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, color: color.muted }}>{t.name}</div>
                <div style={{ fontFamily: font.figures, fontSize: 36, fontWeight: 600, marginTop: 10, color: color.ink }}>
                  {t.price}
                  <span style={{ fontSize: 15, color: color.muted, fontWeight: 500 }}>{t.suffix}</span>
                </div>
                <div style={{ fontSize: 14, color: color.body, marginTop: 16, lineHeight: 1.9 }}>
                  {t.lines.map((l) => (
                    <div key={l}>{l}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div key={t.name} style={{ background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: 14, padding: '30px 26px' }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: color.muted }}>{t.name}</div>
                <div style={{ fontFamily: font.figures, fontSize: 36, fontWeight: 600, marginTop: 10 }}>
                  {t.price}
                  <span style={{ fontSize: 15, color: color.muted, fontWeight: 500 }}>{t.suffix}</span>
                </div>
                <div style={{ fontSize: 14, color: color.body, marginTop: 16, lineHeight: 1.9 }}>
                  {t.lines.map((l) => (
                    <div key={l}>{l}</div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 52 }}>
          <OpenAppButton large />
        </div>
      </section>

      </main>

      <footer style={{ borderTop: '1px solid rgba(20,22,26,0.1)', padding: 28 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: color.muted, gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Logo size={20} />
            <Wordmark size={16} />
          </div>
          <div style={{ fontFamily: font.figures, fontWeight: 600, color: color.accentInk }}>{TAGLINE}</div>
          <div className="k-inline-links">
            local-first receipt &amp; return tracking · <a href="#how">how it works</a> · <a href="#pricing">pricing</a> · <a href="/rights/">your rights</a> · <a href="/privacy/">privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
