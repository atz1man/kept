import { palette, font } from '../tokens';
import { fmtDateLong, fromISODate, toISODate } from '../lib/dates';
import { COOLING_OFF_DAYS, REJECT_DAYS } from '../lib/legal';
import { CHECKED_ON, STORE_POLICIES, clockFor, shopCheckedOn, windowFor, type StorePolicy } from '../lib/stores';
import { returnsPageFor } from '../lib/returns-pages';
import { CHRISTMAS } from '../lib/christmas';
import { withPolicy } from '../lib/csp';

/**
 * A page per shop: "ASOS returns policy: 28 days from delivery".
 *
 * People search for a shop's returns policy, not for a returns app, so each
 * shop the app has checked gets a page that answers that search in its first
 * line, with the shop's own page linked as the source and the date it was
 * read. Written at build time as plain HTML (vite.config.ts), so a search
 * engine reads it without running anything.
 *
 * Only shops with a CURRENT check against their own page get one. A page
 * about a window nobody has read is a guess with a URL, and the research
 * behind this (thin templated pages are what search engines now demote) says
 * the same thing from the other side: every page here carries facts the
 * others do not — its window, its clock, its small print, its Christmas date
 * and its source.
 */
export interface ShopPage {
  /** Served path, with the trailing slash the site uses: /returns/asos/. */
  path: string;
  /** Where the HTML goes in the build: returns/asos/index.html. */
  file: string;
  title: string;
  html: string;
}

export const ORIGIN = 'https://getquidsin.co.uk';
export const SHOP_PAGES_DIR = 'returns';

export function slugFor(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (iso: string) => fmtDateLong(fromISODate(iso));

/** The clock in words: "from delivery", "from the day you buy it". */
function from(clock: StorePolicy['clockStart']): string {
  return clock === 'purchase' ? 'from the day you buy it' : clock === 'delivery' ? 'from delivery' : 'from dispatch';
}

/** The headline window, and the in-store one too where it differs from online. */
export function windowLine(shop: StorePolicy): { headline: string; detail: string | null } {
  const online = { days: windowFor(shop, true), clock: clockFor(shop, true) };
  const store = { days: windowFor(shop, false), clock: clockFor(shop, false) };
  const headline = `${online.days} days ${from(online.clock)}`;
  const same = online.days === store.days && online.clock === store.clock;
  return {
    headline,
    detail: same ? null : `Online: ${online.days} days ${from(online.clock)}. In a shop: ${store.days} days ${from(store.clock)}.`,
  };
}

/** The table's policy sentence without the shop's name in front, which the page's heading already says. */
export function policyWords(shop: StorePolicy): string {
  const prefix = `${shop.name} · `;
  const words = shop.policy.startsWith(prefix) ? shop.policy.slice(prefix.length) : shop.policy;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The shops that get a page: a current check, and a returns page of their own to cite. */
export function shopsWithPages(today: Date): StorePolicy[] {
  return STORE_POLICIES.filter((s) => shopCheckedOn(s.name, today) !== null && returnsPageFor(s.name) !== null);
}

function shell(opts: { title: string; description: string; canonical: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(opts.title)}</title>
  <meta name="description" content="${esc(opts.description)}" />
  <link rel="canonical" href="${opts.canonical}" />
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/${SHOP_PAGES_DIR}/returns.css" />
</head>
<body>
  <header class="bar"><a class="home" href="/">Quids In</a><a class="cta" href="/app/">Open Quids In</a></header>
  <main>
${opts.body}
  </main>
  <footer><a href="/">Quids In</a> · <a href="/${SHOP_PAGES_DIR}/">Every shop’s returns policy</a> · <a href="/rights/">What the law gives you</a> · <a href="/privacy/">Privacy</a></footer>
</body>
</html>
`;
}

export function shopPage(shop: StorePolicy, today: Date): ShopPage {
  const slug = slugFor(shop.name);
  const path = `/${SHOP_PAGES_DIR}/${slug}/`;
  const { headline, detail } = windowLine(shop);
  const source = returnsPageFor(shop.name)!;
  const checked = CHECKED_ON[shop.name];
  const iso = toISODate(today);
  const xmas = CHRISTMAS.find((x) => x.store === shop.name && x.returnBy >= iso);
  const title = `${shop.name} returns policy: ${headline}`;
  const description = `${shop.name} gives you ${headline} to return something${shop.gotcha ? `, with a catch` : ''}. Checked against ${source.host} on ${day(checked)}, beside the ${REJECT_DAYS} and ${COOLING_OFF_DAYS} days the law gives you.`;
  const body = `    <p class="crumb"><a href="/${SHOP_PAGES_DIR}/">Returns policies</a> › ${esc(shop.name)}</p>
    <h1>${esc(shop.name)} returns policy</h1>
    <p class="answer"><strong>${esc(headline)}.</strong></p>
${detail ? `    <p>${esc(detail)}</p>\n` : ''}    <p>${esc(policyWords(shop))}</p>
${shop.gotcha ? `    <aside class="small-print"><h2>The small print</h2><p>${esc(shop.gotcha)}</p></aside>\n` : ''}${xmas ? `    <section class="christmas"><h2>Christmas returns</h2><p>${esc(shop.name)} takes ${esc(xmas.condition ?? 'things')} ${xmas.appliesTo === 'online' ? 'ordered online' : xmas.appliesTo === 'store' ? 'bought in a shop' : 'bought'} ${xmas.boughtTo ? `${day(xmas.boughtFrom)} to ${day(xmas.boughtTo)}` : `from ${day(xmas.boughtFrom)}`} back until <strong>${day(xmas.returnBy)}</strong>.${xmas.excludes ? ` ${esc(xmas.excludes)}` : ''}</p></section>\n` : ''}    <section>
      <h2>What the law adds</h2>
      <p>Whatever ${esc(shop.name)}’s own window says, if something is faulty the Consumer Rights Act 2015 gives you ${REJECT_DAYS} days to reject it for a full refund. Most things bought online also come with ${COOLING_OFF_DAYS} days to cancel, faulty or not, counted from the day they arrive. <a href="/rights/">What the law gives you</a></p>
    </section>
    <p class="source">Checked against <a href="${esc(source.url)}" rel="nofollow">${esc(source.host)}</a>, ${esc(shop.name)}’s own returns page, on ${day(checked)}. Shops change their terms; this is a guide, not legal advice.</p>
    <section class="pitch">
      <h2>Never miss the date</h2>
      <p>Quids In counts down every return window, ${esc(shop.name)}’s included, and puts whatever runs out first at the top. No account, and nothing leaves your phone.</p>
      <p><a class="button" href="/app/">Open Quids In</a></p>
    </section>`;
  return { path, file: `${SHOP_PAGES_DIR}/${slug}/index.html`, title, html: shell({ title: `${title} — Quids In`, description, canonical: `${ORIGIN}${path}`, body }) };
}

/** The index of every shop page, A to Z. */
export function shopIndex(today: Date): ShopPage {
  const shops = shopsWithPages(today).slice().sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
  const title = 'UK shops’ returns policies, checked';
  const rows = shops
    .map((s) => `      <li><a href="/${SHOP_PAGES_DIR}/${slugFor(s.name)}/">${esc(s.name)}</a> <span>${esc(windowLine(s).headline)}</span></li>`)
    .join('\n');
  const body = `    <h1>${title}</h1>
    <p class="answer">How long ${shops.length} UK shops give you to return something, each read off the shop’s own returns page, with the date it was checked.</p>
    <ul class="shops">
${rows}
    </ul>`;
  return {
    path: `/${SHOP_PAGES_DIR}/`,
    file: `${SHOP_PAGES_DIR}/index.html`,
    title,
    html: shell({ title: `${title} — Quids In`, description: `Return windows for ${shops.length} UK shops, each checked against the shop’s own returns page.`, canonical: `${ORIGIN}/${SHOP_PAGES_DIR}/`, body }),
  };
}

/** Every page: the index first, then a page per shop. */
export function allShopPages(today: Date): ShopPage[] {
  return [shopIndex(today), ...shopsWithPages(today).map((s) => shopPage(s, today))];
}

/** A sitemap of those pages, kept beside them and named in robots.txt. */
export function shopSitemap(pages: readonly ShopPage[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${ORIGIN}${p.path}</loc></url>`).join('\n')}
</urlset>
`;
}

/** The pages' one stylesheet: the site's own colours and face, light, nothing inline (the policy forbids it). */
export function shopCss(): string {
  const c = palette.light;
  // The face the tokens name first, from the same file styles.css serves it from.
  const face = font.ui.split(',')[0];
  return `@font-face{font-family:${face};src:url('/fonts/geist.woff2') format('woff2');font-weight:100 900;font-display:swap}
*{box-sizing:border-box}
:root{color-scheme:light;background:${c.canvas}}
body{margin:0;background:${c.canvas};color:${c.ink};font:17px/1.6 ${font.ui};-webkit-text-size-adjust:100%}
a{color:${c.accentInk}}
.bar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid ${c.borderHair}}
.bar .home{font:700 20px/1 ${font.display};color:${c.ink};text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.bar .cta,.button{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:999px;background:${c.accent};color:${c.white};font-weight:600;text-decoration:none}
main{max-width:720px;margin:0 auto;padding:24px 20px 48px}
main p{color:${c.body}}
.crumb{font-size:14px;color:${c.muted};margin:0 0 8px}
h1{font:700 clamp(30px,6vw,44px)/1.1 ${font.display};letter-spacing:-0.03em;color:${c.ink};margin:0 0 12px}
h2{font:650 20px/1.3 ${font.display};color:${c.ink};margin:0 0 6px}
.answer{font-size:21px;color:${c.ink};margin:0 0 12px}
section,aside{margin-top:28px}
.small-print{background:${c.caution};color:${c.cautionInk};border-radius:16px;padding:16px 18px}
.small-print h2,.small-print p{color:${c.cautionInk}}
.christmas,.pitch{background:${c.surfaceAlt};border-radius:16px;padding:16px 18px}
.source{font-size:15px;color:${c.muted};margin-top:28px}
.shops{list-style:none;padding:0;margin:20px 0 0;display:grid;gap:2px}
.shops li{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid ${c.borderHair}}
.shops a{font-weight:600;min-height:24px}
.shops span{color:${c.muted}}
footer{max-width:720px;margin:0 auto;padding:24px 20px 40px;font-size:15px;color:${c.muted};border-top:1px solid ${c.borderHair}}
`;
}

/**
 * Every file the build writes for these pages, each page carrying the same
 * content security policy as every other built page. One list, so what the
 * build emits and what the tests read are the same thing.
 */
export function shopFiles(today: Date, policy: string): { fileName: string; source: string }[] {
  const pages = allShopPages(today);
  return [
    ...pages.map((p) => ({ fileName: p.file, source: withPolicy(p.html, policy) })),
    { fileName: `${SHOP_PAGES_DIR}/returns.css`, source: shopCss() },
    { fileName: `${SHOP_PAGES_DIR}/sitemap.xml`, source: shopSitemap(pages) },
  ];
}
