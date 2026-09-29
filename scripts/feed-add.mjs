/**
 * Publish one checked policy change to the feed.
 *
 *   npm run feed:add -- --id u_currys_window_30 --store Currys \
 *     --changed 2026-10-01 --window 30 \
 *     --text "Currys now gives 30 days from delivery for a change of mind." \
 *     --note "new purchases get 30 days from delivery" \
 *     --source https://www.currys.co.uk/help/returns-and-cancellations
 *
 * The routine Policy Watch never had. The feed shipped five samples as
 * "verified" news that nobody had checked, because nothing about publishing
 * asked where a change came from. Here it is the first question:
 *
 * - `--source` must be an https page on a host that retailer's OWN returns
 *   pages use (store/retailer-sources.json). A news article, a forum post or
 *   a search result is not the retailer's terms, and cannot be cited.
 * - the store must be one the table knows, by its own name;
 * - the date cannot be in the future — a promise is not a change;
 * - the id must be new, unless `--replace` says this corrects an entry.
 *
 * It writes public/policy-feed.json and stops there. If the feed is signed
 * (APN-19), run `npm run feed:sign` next; the app refuses an unsigned feed
 * once a key is configured.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSources, readTable } from './retailer-check-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hostOf = (u) => new URL(u).hostname.replace(/^www\d?\./, '');

/**
 * The feed with one entry added, or why not. Pure, so it can be tested
 * without a file: `table` is stores.ts read as rows, `sources` the retailer
 * sources list, `today` an ISO date.
 */
export function addEntry(doc, args, { table, sources, today }) {
  if (!doc || doc.feed !== 'kept-policy' || !Array.isArray(doc.updates)) return { error: 'public/policy-feed.json is not a kept feed' };
  const row = table.find((r) => r.name === args.store);
  if (!row) return { error: `"${args.store}" is not a shop in the table — use its name as stores.ts writes it` };
  if (!/^u_[a-z0-9_]+$/.test(args.id ?? '')) return { error: '--id must look like u_shop_what_changed (lowercase, underscores)' };
  const exists = doc.updates.some((u) => u.id === args.id);
  if (exists && !args.replace) return { error: `${args.id} is already published — pass --replace to correct it` };
  if (!ISO.test(args.changed ?? '')) return { error: '--changed must be a date like 2026-10-01' };
  if (args.changed > today) return { error: '--changed is in the future: a promise is not a change' };
  const text = (args.text ?? '').trim();
  if (!text || text.length > 2000) return { error: '--text is the sentence the Watch tab shows, under 2000 characters' };
  let window;
  if (args.window !== undefined) {
    window = Number(args.window);
    if (!Number.isInteger(window) || window < 1 || window > 3650) return { error: '--window must be a whole number of days' };
  }
  let url;
  try {
    url = new URL(args.source ?? '');
  } catch {
    return { error: '--source must be the address of the retailer’s own returns page' };
  }
  if (url.protocol !== 'https:') return { error: '--source must be https' };
  const own = (sources[row.name] ?? []).map(hostOf);
  if (!own.includes(hostOf(url.href))) {
    return { error: `--source must be on ${row.name}'s own site (${own.join(', ') || 'none listed'}), not ${hostOf(url.href)}` };
  }
  const checkedOn = args.checked ?? today;
  if (!ISO.test(checkedOn) || checkedOn > today) return { error: '--checked must be the date the page was read, not a future one' };

  const entry = {
    id: args.id,
    store: row.name,
    changedOn: args.changed,
    text,
    affectsStores: [row.name],
    affectNote: (args.note ?? '').trim(),
    ...(window !== undefined ? { newWindowDays: window } : {}),
    source: { url: url.href, checkedOn },
  };
  const updates = [...doc.updates.filter((u) => u.id !== args.id), entry].sort((a, b) => b.changedOn.localeCompare(a.changedOn));
  return { doc: { ...doc, updatedAt: today, updates } };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const name = k.slice(2);
    if (name === 'replace') out.replace = true;
    else out[name] = argv[++i];
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const feedPath = join(ROOT, 'public/policy-feed.json');
  const doc = JSON.parse(readFileSync(feedPath, 'utf8'));
  const res = addEntry(doc, parseArgs(process.argv.slice(2)), {
    table: readTable(readFileSync(join(ROOT, 'src/lib/stores.ts'), 'utf8')),
    sources: readSources(join(ROOT, 'store/retailer-sources.json')),
    today: new Date().toISOString().slice(0, 10),
  });
  if (res.error) {
    console.error(`✗ ${res.error}`);
    process.exit(1);
  }
  writeFileSync(feedPath, `${JSON.stringify(res.doc, null, 2)}\n`);
  console.log(`✓ published to public/policy-feed.json — ${res.doc.updates.length} change(s)`);
  console.log('  If the feed is signed, run npm run feed:sign next; then commit both files.');
}
