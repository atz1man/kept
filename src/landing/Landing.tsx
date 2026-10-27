import type { ReactNode } from 'react';
import { color, font, gradient, shadow, radius } from '../tokens';
import { Logo, Tick, Wordmark } from '../app/components/Icons';
import { UNLOCK } from '../lib/pricing';
import { FREE_TIER_LIMIT } from '../lib/quota';
import { STORE_COUNT, STORE_POLICIES, findStore } from '../lib/stores';
import { COOLING_OFF_DAYS, REJECT_DAYS } from '../lib/legal';
import { CONTACT_EMAIL, TAGLINE, TAGLINE_LEAD } from '../lib/brand';
import { tickerLines } from './ticker';
import { CompanyDisclosure } from '../pages/Disclosure';
import { FinePrintArt, HaulArt, LostReceiptsArt } from './sections/ProblemArt';
import { DeadlinesArt, LetterArt, PhoneOnlyArt, ScanArt, SmallPrintArt, TwoClocksArt } from './sections/ProductArt';
import { Faq } from './sections/Faq';
import { Card, OpenAppButton, SectionHead, WRAP } from './sections/primitives';

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
  { art: <FinePrintArt />, title: 'Nobody reads clause 14b', body: '“30 days from dispatch, unworn, tags attached, exclusions apply.” Quids In reads it so you never have to.' },
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

const SMALL_PRINT = ['Zara', 'Uniqlo', 'ASOS'].map((name) => {
  const s = findStore(name);
  return { store: name, days: s?.windowDays ?? 0, text: s?.gotcha ?? '' };
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

/*
 * The home screen in miniature: three receipts, soonest first. The windows
 * are the table's; the days left and the prices are an example, and the
 * picture says so by being a picture — it names no date.
 */
const EXAMPLE_ROWS = [
  { shop: 'ASOS', item: 'Linen shirt, size M', days: 2, of: days('ASOS'), price: '£32.00' },
  { shop: 'Currys', item: 'JBL headphones', days: 9, of: days('Currys'), price: '£89.99' },
  { shop: 'IKEA', item: 'Bookcase, white', days: 301, of: days('IKEA'), price: '£45.00' },
];

/**
 * What Quids In does, one row each, with the screen that does it beside the
 * words. The order is the order someone meets them in: the deadlines first,
 * because that is what the app opens on.
 */
const WHY: { n: string; title: string; body: string; link?: { href: string; label: string }; art: ReactNode }[] = [
  // "a heads-up when something must go back this week" implied a background
  // service. See notify.ts: a web app cannot wake itself, and the onboarding
  // was corrected for this exact claim while these two lines kept making it.
  { n: '01', title: 'Deadline alerts', body: 'A clear countdown on every item, works offline, and an alert the moment you open Quids In with something due this week. No background service, because a web app cannot wake itself — so it checks every time you come back.', art: <DeadlinesArt rows={EXAMPLE_ROWS} /> },
  { n: '02', title: 'Knows the real policies', body: `IKEA’s ${days('IKEA')} days, Boots’ ${days('Boots')}, Apple’s ${days('Apple')} — Quids In’s own list of windows for ${STORE_COUNT} major UK retailers, plus the gotchas: Zara’s clock starts at dispatch, Uniqlo won’t refund online orders in store.`, art: <SmallPrintArt cards={SMALL_PRINT} /> },
  // The two numbers the whole legal half of the product turns on, taken from
  // the module that computes them rather than typed again here. They were
  // prose, beside three shop windows that had already been made derived for
  // exactly this reason.
  { n: '03', title: 'Knows your legal rights', body: `The Consumer Rights Act gives you ${REJECT_DAYS} days to reject faulty goods for a full refund, and online orders carry a ${COOLING_OFF_DAYS}-day cooling-off by law. Quids In shows the legal deadline beside the shop’s own.`, link: { href: '/rights/', label: 'What the law gives you →' }, art: <TwoClocksArt shopDays={days('Zara')} lawDays={REJECT_DAYS} coolingDays={COOLING_OFF_DAYS} /> },
  // Scanning is read on the phone and never uploaded, and it never saves by
  // itself: what it read is shown to be checked first, because OCR on a
  // creased thermal slip is not always right. The copy says so.
  { n: '04', title: 'Paste or scan, done', body: 'Paste an order email, or photograph a till receipt, and Quids In reads the store, total and date on your phone and sets the deadline. You check what it read before anything is saved.', art: <ScanArt /> },
  { n: '05', title: 'When it breaks', body: 'Put a warranty length on a receipt and Quids In counts it down beside the return window. If something goes wrong, it says what the law gives you that day — a refund, or a free repair — and drafts the letter to the shop, with the right section of the Consumer Rights Act in it.', art: <LetterArt /> },
];

/*
 * "No server" was the loose word — the app is served from one and downloads
 * the policy feed from it on every launch. Naming the one call, and its
 * direction, is a better privacy claim than denying it.
 */
const PRIVATE = {
  title: 'Private by design',
  body: 'Everything lives on your phone. No account, nothing uploaded, no one reading your purchases. Policy updates download to you; nothing about you goes back. Export a backup anytime.',
  points: ['No account to make', 'No receipts uploaded', 'Works offline', 'Your backup, your file'],
};

/**
 * The selling copy is this page's own; the price comes from lib/pricing.ts,
 * which Settings and the add screen read too. A price that says one thing on
 * the page someone bought from and another inside the product is not a
 * cosmetic drift.
 */
const PLANS = [
  { name: 'Free', price: '£0', suffix: '', lines: [`Your first ${FREE_TIER_LIMIT} receipts`, 'Every shop, every deadline', 'Scanning and letters included'], featured: false },
  { name: 'Unlimited', price: UNLOCK.price, suffix: UNLOCK.suffix, lines: ['Unlimited receipts, for good', 'One payment, no subscription', 'Everything in Free'], featured: true },
];

/** The shops named as chips: the table opens with the biggest, and a hundred chips is a wall. */
const SHOWN_SHOPS = 20;

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#private', label: 'Privacy' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'Questions' },
];

/**
 * The hero's gradient, declared with its LIGHTEST stop as the colour: the
 * contrast sweep reads colours, not gradients, so every word on it is
 * measured where white is weakest — the app's balance card does the same.
 */
const ON_HERO = { backgroundColor: color.heroEnd, backgroundImage: gradient.hero, color: color.white } as const;

export function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: color.canvas }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: color.bar, borderBottom: `1px solid ${color.borderHair}` }}>
        <div style={{ ...WRAP, padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }} aria-label="Quids In home">
            <Logo size={30} />
            <Wordmark />
          </a>
          <nav aria-label="Main" style={{ display: 'flex', alignItems: 'center', gap: 26, fontSize: 14.5, fontWeight: 600 }}>
            {NAV.map((n) => (
              <a key={n.href} className="k-wide-only" href={n.href} style={{ color: color.bodyStrong }}>{n.label}</a>
            ))}
            <a className="k-primary" href="/app/" style={{ display: 'flex', alignItems: 'center', gap: 8, background: color.accent, color: color.white, padding: '11px 20px', borderRadius: radius.control, fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
              Open Quids In
            </a>
          </nav>
        </div>
      </header>

      <main>
      {/* Hero */}
      <section style={{ ...ON_HERO, position: 'relative', overflow: 'hidden' }}>
        {/* Light on the glass: two soft discs, decorative — as the app's balance card. */}
        <div aria-hidden="true" style={{ position: 'absolute', width: 640, height: 640, borderRadius: 999, right: -220, top: -260, background: color.onHeroGlass, opacity: 0.35, pointerEvents: 'none' }} />
        <div aria-hidden="true" style={{ position: 'absolute', width: 420, height: 420, borderRadius: 999, left: -180, bottom: -220, background: color.onHeroGlass, opacity: 0.25, pointerEvents: 'none' }} />
        <div style={{ ...WRAP, position: 'relative', padding: 'clamp(40px, 7vw, 88px) 28px clamp(48px, 7vw, 96px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            {/* The words wrap BESIDE the dot, in their own box. With the text
                as a bare flex item and the row allowed to wrap, a line too long
                for a phone moved the whole sentence below the dot and left the
                dot alone on a line of its own. */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%', boxSizing: 'border-box', borderRadius: radius.pill, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: color.white, background: color.onHeroChip, marginBottom: 26 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: color.gold, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>No account · no cloud · no one sees your receipts</span>
            </div>
            <h1 style={{ fontFamily: font.display, fontSize: 'clamp(40px, 6vw, 70px)', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.04em', margin: 0, color: color.white }}>
              Know every return deadline before it passes.
            </h1>
            <p style={{ fontSize: 'clamp(17px, 1.6vw, 19.5px)', lineHeight: 1.6, color: color.onHeroSoft, maxWidth: 540, margin: '24px 0 0' }}>
              Quids In remembers every receipt, knows each shop’s real return policy and your legal rights — and shows you what is about to run out the moment you open it.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34, flexWrap: 'wrap' }}>
              <OpenAppButton onHero />
              <a href="#how" className="k-ghost" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, padding: '0 22px', borderRadius: 999, border: `1.5px solid ${color.onHeroSoft}`, color: color.white, fontWeight: 600, fontSize: 15.5 }}>
                See how it works
              </a>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '30px 0 0', display: 'flex', flexWrap: 'wrap', gap: '10px 22px', fontSize: 14, fontWeight: 600, color: color.white }}>
              {[`Free for your first ${FREE_TIER_LIMIT} receipts`, 'No account needed', 'Works offline'].map((t) => (
                <li key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Tick size={15} stroke={color.gold} width={2.6} />
                  {t}
                </li>
              ))}
            </ul>
            {/* One source with the footer below and with Settings — see
                lib/brand.ts for what it used to say and why it does not. */}
            <div style={{ marginTop: 22, fontSize: 14, fontWeight: 600, color: color.onHeroSoft }}>
              {TAGLINE_LEAD}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
              <span className="k-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: color.gold }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: color.white }}>
                Live demo — try it
              </span>
            </div>
            {/*
              The real app, not a video: it is the same build served from /app/,
              so the demo cannot drift from the product the way a recording does.
              Onboarding is skipped for the embed via the query flag. Set in a
              phone's bezel, drawn in the page's ink.
            */}
            <div style={{ margin: '0 auto', maxWidth: 418, padding: 8, borderRadius: 52, background: color.ink, boxShadow: '0 30px 80px rgba(10,10,18,0.45)' }}>
              <div style={{ borderRadius: 44, overflow: 'hidden', background: color.canvas }}>
                <iframe
                  src="/app/?embed=1"
                  title="Quids In — live app demo"
                  loading="lazy"
                  style={{ width: '100%', height: 812, border: 0, display: 'block' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div style={{ background: color.surface, borderBottom: `1px solid ${color.borderHair}`, padding: '16px 0', overflow: 'hidden', whiteSpace: 'nowrap' }} aria-hidden="true">
        <div className="k-ticker" style={{ display: 'inline-flex', gap: 48, fontSize: 14, fontWeight: 500, color: color.body }}>
          {[...TICKER, ...TICKER].map((line, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 48 }}>
              <span>{line}</span>
              <span style={{ color: color.muted }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* The problem */}
      <section aria-labelledby="problem" style={{ ...WRAP, padding: 'clamp(64px, 9vw, 112px) 28px 0' }}>
        <SectionHead id="problem" eyebrow="The problem" title="You shop in seconds. The fine print takes hours." lede="Every shop runs its own clock, starts it on a different day, and hides the exceptions where nobody looks. So the money stays with them." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 18, marginTop: 44 }}>
          {PROBLEMS.map((p) => (
            <Card key={p.title} style={{ overflow: 'hidden' }}>
              <div style={{ height: 220 }}>{p.art}</div>
              <div style={{ padding: '22px 24px 26px' }}>
                <h3 style={{ fontWeight: 650, fontSize: 17.5, margin: 0, letterSpacing: '-0.01em' }}>{p.title}</h3>
                <p style={{ fontSize: 14.5, color: color.body, lineHeight: 1.6, margin: '8px 0 0' }}>{p.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works: the product, row by row */}
      <section id="how" aria-labelledby="how-title" className="k-anchor" style={{ ...WRAP, padding: 'clamp(72px, 10vw, 128px) 28px 0' }}>
        <SectionHead id="how-title" eyebrow="How it works" title="The shop’s clock, the law’s clock, and yours — on one screen." center />
        <div style={{ display: 'grid', gap: 'clamp(56px, 8vw, 104px)', marginTop: 'clamp(48px, 7vw, 80px)' }}>
          {WHY.map((w, i) => (
            <div key={w.n} className={i % 2 ? 'k-split k-flip' : 'k-split'}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 14, background: color.accentSoft, fontFamily: font.figures, fontSize: 15, fontWeight: 700, color: color.accentInk }}>{w.n}</div>
                <h3 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 'clamp(24px, 2.6vw, 32px)', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '18px 0 0' }}>{w.title}</h3>
                <p style={{ fontSize: 16.5, lineHeight: 1.65, color: color.body, margin: '14px 0 0', maxWidth: 520 }}>{w.body}</p>
                {w.link && (
                  <a href={w.link.href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 6, fontSize: 15, fontWeight: 600, color: color.accentInk }}>
                    {w.link.label}
                  </a>
                )}
              </div>
              <div style={{ minWidth: 0 }}>{w.art}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Policy watch, and the shops it already knows */}
      <section aria-labelledby="watch" style={{ ...WRAP, padding: 'clamp(72px, 10vw, 128px) 28px 0' }}>
        <div style={{ background: color.surfaceAlt, borderRadius: radius.hero, padding: 'clamp(28px, 5vw, 56px)' }}>
          <SectionHead
            id="watch"
            eyebrow="Policy watch"
            title="Shops rewrite the rules quietly. Quids In checks your receipts when they do."
            lede="Retailers change return windows and never send a memo. When one does, Quids In’s list changes and every receipt you hold is checked against it. A purchase keeps the terms it was made under; you just find out when the shop moves the goalposts for the next one."
          />
          <div style={{ marginTop: 32, fontSize: 14, fontWeight: 600, color: color.bodyStrong }}>
            Return windows already built in for {STORE_COUNT} UK shops:
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STORE_POLICIES.slice(0, SHOWN_SHOPS).map((s) => (
              <li key={s.name} style={{ background: color.surface, borderRadius: radius.pill, padding: '8px 14px', fontSize: 14, fontWeight: 600, color: color.ink, boxShadow: shadow.raised }}>
                {s.name} <span style={{ color: color.muted, fontWeight: 500 }}>· {s.windowDays} days</span>
              </li>
            ))}
            {STORE_COUNT > SHOWN_SHOPS && (
              <li style={{ background: color.accentSoft, borderRadius: radius.pill, padding: '8px 14px', fontSize: 14, fontWeight: 600, color: color.accentInk }}>
                and {STORE_COUNT - SHOWN_SHOPS} more
              </li>
            )}
          </ul>
          <p style={{ fontSize: 14, color: color.muted, margin: '18px 0 0', lineHeight: 1.6 }}>
            Shopping somewhere else? Enter the window from your receipt, and Quids In counts it down just the same.
          </p>
        </div>
      </section>

      {/* Private by design */}
      <section id="private" aria-labelledby="private-title" className="k-anchor" style={{ ...WRAP, padding: 'clamp(72px, 10vw, 128px) 28px 0' }}>
        <div style={{ ...ON_HERO, borderRadius: radius.hero, padding: 'clamp(28px, 6vw, 72px)', position: 'relative', overflow: 'hidden' }}>
          <div className="k-split">
            <div style={{ minWidth: 0 }}>
              <SectionHead id="private-title" onInk eyebrow="Privacy" title={PRIVATE.title} lede={PRIVATE.body} />
              <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
                {PRIVATE.points.map((p) => (
                  <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, background: color.onHeroChip, borderRadius: 14, padding: '12px 14px' }}>
                    <Tick size={16} stroke={color.gold} width={2.6} />
                    {p}
                  </li>
                ))}
              </ul>
              <a href="/privacy/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 14, fontSize: 15, fontWeight: 600, color: color.white, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                Read the privacy policy
              </a>
            </div>
            <div style={{ minWidth: 0 }}>
              <PhoneOnlyArt />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title" className="k-anchor" style={{ ...WRAP, padding: 'clamp(72px, 10vw, 128px) 28px 0' }}>
        <SectionHead id="pricing-title" center eyebrow="Pricing" title={<>Free for your first {FREE_TIER_LIMIT} receipts.</>} lede={<>Then {UNLOCK.price}, once, for unlimited. No subscription.</>} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 20, maxWidth: 680, margin: '48px auto 0' }}>
          {PLANS.map((t) => (
            <div
              key={t.name}
              style={t.featured
                ? { background: color.surface, borderRadius: radius.hero, padding: '34px 30px', position: 'relative', border: `1.5px solid ${color.accent}`, boxShadow: shadow.raisedLg }
                : { background: color.surfaceAlt, borderRadius: radius.hero, padding: '34px 30px' }}
            >
              {t.featured && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: color.accent, color: color.white, fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: radius.pill, whiteSpace: 'nowrap' }}>
                  Pay once
                </div>
              )}
              <h3 style={{ fontWeight: 600, fontSize: 15, color: color.muted, margin: 0 }}>{t.name}</h3>
              <div style={{ fontFamily: font.figures, fontVariantNumeric: 'proportional-nums', fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 10, color: color.ink }}>
                {t.price}
                <span style={{ fontSize: 16, color: color.muted, fontWeight: 500, letterSpacing: 0 }}>{t.suffix}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'grid', gap: 10, fontSize: 15, color: color.body }}>
                {t.lines.map((l) => (
                  <li key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Tick size={15} stroke={color.accentFigure} width={2.4} />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Questions */}
      <section id="faq" aria-labelledby="faq-title" className="k-anchor" style={{ ...WRAP, maxWidth: 880, padding: 'clamp(72px, 10vw, 128px) 28px 0' }}>
        <SectionHead id="faq-title" center eyebrow="Questions" title="Before you hand over a receipt" />
        <div style={{ marginTop: 40 }}>
          <Faq />
        </div>
      </section>

      {/* The last word */}
      <section aria-labelledby="cta-title" style={{ ...WRAP, padding: 'clamp(72px, 10vw, 128px) 28px clamp(72px, 10vw, 112px)' }}>
        <div style={{ ...ON_HERO, borderRadius: radius.hero, padding: 'clamp(40px, 7vw, 80px) clamp(24px, 5vw, 64px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', width: 520, height: 520, borderRadius: 999, right: -160, top: -300, background: color.onHeroGlass, opacity: 0.3, pointerEvents: 'none' }} />
          <h2 id="cta-title" style={{ position: 'relative', fontFamily: font.display, fontSize: 'clamp(32px, 4.6vw, 54px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, margin: 0, color: color.white }}>
            Stop donating money to shops.
          </h2>
          <p style={{ position: 'relative', fontSize: 17.5, lineHeight: 1.6, color: color.onHeroSoft, margin: '18px auto 0', maxWidth: 520 }}>
            Add the receipts in your pockets tonight, and see which of them still have money in them.
          </p>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 34 }}>
            <OpenAppButton large onHero />
          </div>
        </div>
      </section>
      </main>

      <footer style={{ borderTop: `1px solid ${color.border}`, background: color.surfaceAlt }}>
        <div style={{ ...WRAP, padding: '56px 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Logo size={28} />
              <Wordmark size={20} />
            </div>
            <div style={{ fontFamily: font.figures, fontWeight: 600, color: color.accentInk, marginTop: 14, fontSize: 14.5 }}>{TAGLINE}</div>
            <p style={{ fontSize: 14, color: color.muted, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 260 }}>
              Local-first receipt and return tracking, made in the UK.
            </p>
          </div>
          <FooterLinks title="Product" links={[['#how', 'How it works'], ['#pricing', 'Pricing'], ['#faq', 'Questions'], ['/app/', 'Open the app']]} />
          <FooterLinks title="Your rights" links={[['/rights/', 'What the law gives you'], ['/privacy/', 'Privacy policy']]} />
          {CONTACT_EMAIL && <FooterLinks title="Contact" links={[[`mailto:${CONTACT_EMAIL}`, CONTACT_EMAIL], ['/privacy/#contact', 'Data requests']]} />}
        </div>
        {/* The trading disclosure the law asks the company's website for —
            the same line, from the same object, as the reading pages. */}
        <div style={{ ...WRAP, padding: '0 28px 40px' }}>
          <div style={{ borderTop: `1px solid ${color.border}`, paddingTop: 22 }}>
            <CompanyDisclosure />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: color.bodyStrong, margin: 0, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{title}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
        {links.map(([href, label]) => (
          <li key={href}>
            <a href={href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, fontSize: 14.5, color: color.body, overflowWrap: 'anywhere' }}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
