import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { COMPANY, REGISTERED_OFFICE } from '../src/lib/brand';
import { Landing } from '../src/landing/Landing';
import { Privacy } from '../src/privacy/Privacy';
import { Rights } from '../src/rights/Rights';

/**
 * Who publishes Quids In, on every page a stranger can open.
 *
 * The Companies (Trading Disclosures) Regulations 2008 ask a company's website
 * for four facts — registered name, number, registered office, and the part of
 * the UK it is registered in — and Apple's organisation enrolment checks that
 * the website belongs to the seller. So each public page is RENDERED and read
 * as text, the way a person or a reviewer reads it, and every fact is looked
 * for as `COMPANY` states it. Read from the object, not restated here: a
 * literal in this file would be one more copy to fall out of step.
 */
const ROOT = join(__dirname, '..');

/** The page as text: tags out, entities back, whitespace folded. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    // React leaves a space where an expression met a tag; ". " and ", " read the same.
    .replace(/ ([.,)])/g, '$1');

const PAGES = [
  ['the landing page', Landing],
  ['the privacy page', Privacy],
  ['the rights page', Rights],
] as const;

describe('the trading disclosure on every public page', () => {
  const facts = [
    ['its registered name', COMPANY.name],
    ['its company number', COMPANY.number],
    ['its registered office', REGISTERED_OFFICE],
    ['where it is registered', `registered in ${COMPANY.jurisdiction}`],
  ] as const;

  it('reads the facts it is meant to be checking', () => {
    // An empty fact matches every page.
    for (const [, fact] of facts) expect(fact.length).toBeGreaterThan(5);
    expect(REGISTERED_OFFICE).toContain(COMPANY.registeredOffice.postcode);
    for (const line of COMPANY.registeredOffice.lines) expect(REGISTERED_OFFICE).toContain(line);
  });

  describe.each(PAGES)('%s', (_, Page) => {
    const page = text(renderToStaticMarkup(createElement(Page)));

    it('renders', () => {
      expect(page.length).toBeGreaterThan(500);
    });

    it.each(facts)('states %s', (_, fact) => {
      expect(page).toContain(fact);
    });

    it('says the company makes Quids In, in the one shared line', () => {
      expect(page).toContain(`Quids In is made by ${COMPANY.name}, registered in ${COMPANY.jurisdiction}, company no. ${COMPANY.number}.`);
    });
  });
});

describe('the privacy policy says whose it is', () => {
  const page = text(renderToStaticMarkup(createElement(Privacy)));
  const who = page.match(/Who runs Quids In (.+?) What Quids In collects/)?.[1] ?? '';

  it('has a section naming the company, before anything else is claimed', () => {
    expect(who).toContain(`made and published by ${COMPANY.name}`);
    expect(who).toContain(`company no. ${COMPANY.number}`);
    expect(who).toContain(REGISTERED_OFFICE);
  });

  it('calls it responsible without claiming it holds anything', () => {
    // The page's whole claim is that nothing is collected; naming a controller
    // must not quietly contradict it.
    expect(who).toMatch(/responsible for the app/);
    expect(who).toMatch(/collects none/);
    expect(page).toContain('What Quids In collects Nothing.');
  });
});

/**
 * Every place the company's name or number is written, held to `COMPANY`.
 *
 * In source, the facts live in `brand.ts` and nowhere else: a page that spells
 * the number out has a copy that will not move when the object does. In the
 * documents that cannot import it — the listing, the submission checklist, the
 * README — each mention must say exactly what `COMPANY` says.
 */
function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(name) ? [p] : [];
  });
}

const BRAND = join(ROOT, 'src', 'lib', 'brand.ts');
const SOURCE = files(join(ROOT, 'src'), /\.(ts|tsx)$/);
const DOCS = [
  join(ROOT, 'README.md'),
  ...files(join(ROOT, 'store'), /\.(md|json)$/),
  ...['index.html', 'app/index.html', 'privacy/index.html', 'rights/index.html'].map((p) => join(ROOT, p)),
].filter((p) => { try { return statSync(p).isFile(); } catch { return false; } });

/** The distinctive words of the name — what any copy of it would contain. */
const NAME_STEM = COMPANY.name.split(' ').slice(0, 2).join(' ');

describe('the company, wherever it is written', () => {
  it('finds the files it is meant to be sweeping', () => {
    expect(SOURCE).toContain(BRAND);
    expect(SOURCE.length).toBeGreaterThan(50);
    expect(DOCS.map((p) => relative(ROOT, p))).toEqual(expect.arrayContaining(['README.md', 'store/listing.json', 'store/SUBMISSION.md']));
  });

  it('is spelled out in source only by brand.ts', () => {
    const copies = SOURCE.filter((p) => p !== BRAND).flatMap((p) => {
      const s = readFileSync(p, 'utf8');
      return [COMPANY.number, NAME_STEM].filter((v) => s.toLowerCase().includes(v.toLowerCase())).map((v) => `${relative(ROOT, p)}: ${v}`);
    });
    expect(copies).toEqual([]);
  });

  it('is named the same in every document that names it', () => {
    const wrong: string[] = [];
    let seen = 0;
    for (const p of DOCS) {
      const s = readFileSync(p, 'utf8');
      // "AP Nexus …" up to the company suffix: the whole name, whatever was typed.
      for (const m of s.matchAll(new RegExp(`${NAME_STEM}[\\w ]*?\\b(?:Limited|Ltd|LTD|LIMITED)\\b\\.?`, 'gi'))) {
        seen++;
        if (m[0] !== COMPANY.name && m[0] !== COMPANY.registeredName) wrong.push(`${relative(ROOT, p)}: ${m[0]}`);
      }
      // Any company number, written the ways people write one.
      for (const m of s.matchAll(/company (?:no\.?|number|reg(?:istration)?\.? no\.?)\s*:?\s*([A-Z]{0,2}\d{5,8})/gi)) {
        seen++;
        if (m[1] !== COMPANY.number) wrong.push(`${relative(ROOT, p)}: company no. ${m[1]}`);
      }
    }
    expect(seen, 'no document names the company — the sweep found nothing to hold').toBeGreaterThanOrEqual(2);
    expect(wrong).toEqual([]);
  });
});
