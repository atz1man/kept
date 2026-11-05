/**
 * Which of the per-shop returns pages (src/landing/shop-pages.ts) the browser
 * sweeps open.
 *
 * Read off the built index rather than named here: a shop's page exists only
 * while its check is current, so a hard-coded "/returns/asos/" would turn the
 * sweeps red the day ASOS's check went stale, for a reason nothing to do with
 * the page. Every shop page is the same template, so the ones worth opening
 * are the ones that render something the others do not: the small print (the
 * one coloured panel, caution ink on a caution ground) and a Christmas date
 * (shown only in season). Plus the index and the first shop, always.
 *
 * Fails loudly with no shop pages at all: a sweep over nothing would pass.
 */
export async function shopPagesToSweep(page, origin) {
  await page.goto(`${origin}/returns/`, { waitUntil: 'networkidle' });
  const shops = await page.$$eval('ul.shops a[href^="/returns/"]', (as) => as.map((a) => a.getAttribute('href')));
  if (shops.length === 0) throw new Error('shop pages: the index at /returns/ lists no shops, so there is nothing to sweep');
  const picked = ['/returns/', shops[0]];
  let smallPrint = null;
  let christmas = null;
  for (const href of shops) {
    if (smallPrint && christmas) break;
    await page.goto(`${origin}${href}`, { waitUntil: 'domcontentloaded' });
    if (!smallPrint && (await page.$('.small-print'))) smallPrint = href;
    if (!christmas && (await page.$('.christmas'))) christmas = href;
  }
  if (!smallPrint) throw new Error('shop pages: no shop page shows small print, so the panel is never swept');
  for (const href of [smallPrint, christmas]) if (href && !picked.includes(href)) picked.push(href);
  return picked;
}
