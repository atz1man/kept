import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The product is called Quids In. It was called kept.
 *
 * It was renamed because two apps called "Kept" were already on the App
 * Store. A rename like that is finished on the day nothing a person can read
 * says the old name, and it comes undone one string at a time — the next
 * sentence written from memory says "kept reads the shop…" and nothing
 * notices, because "kept" is also an ordinary English word in this codebase:
 * a receipt can be kept, money is kept back, a photo is kept with a receipt.
 * So this cannot be a search for the word. It looks for the three shapes the
 * BRAND took and the verb never does:
 *
 *   - the wordmark, "kept." with its full stop, where nothing follows the dot
 *     (`kept.v1` and `kept.unlimited` are identifiers and are left alone);
 *   - "Kept" capitalised as a word on its own, the way a sentence starts with
 *     the name (`justKept` and `KeptState` are identifiers and do not match);
 *   - "kept" as the subject of a sentence — "kept reads", "kept can", "open
 *     kept" — which is how the lowercase name was written everywhere.
 *
 * Comments are stripped first: they explain the code to the people writing
 * it, and some of them are about the rename itself.
 *
 * What stays is listed below, each with its reason, and every entry has to
 * still match something: an allowlist that outlives the line it excused is
 * a hole with a reason written beside it.
 */
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

/**
 * Comments become blank space of the same shape, so line numbers hold.
 *
 * A block comment is only one that opens where a comment can: not mid-word.
 * The first version took any slash-star, and `accept="image/*"` on the Add
 * screen opened a "comment" that ran to the next star-slash and hid every
 * sentence in between — "kept reads the store" among them — so the sweep
 * passed lines it had never looked at.
 */
const stripComments = (text: string) =>
  text
    .replace(/(?<![\w/*'"])\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    // Spaces and tabs, not \s: under the multiline flag \s* swallows the
    // blank lines above a comment, and every line number after it drifts.
    .replace(/^[ \t]*\/\/.*$/gm, (c) => ' '.repeat(c.length));

const SHAPES: readonly [string, RegExp][] = [
  // "kept." in a string, or "kept" then the tag that coloured its full stop.
  ['the wordmark "kept."', /\bkept(?:\.(?![\w-])|<)/g],
  ['"Kept" as a word on its own', /\bKept\b/g],
  [
    'the name as the subject of a sentence',
    /\bkept(?:’s|'s)|\bkept (?:reads|can|cannot|could|couldn’t|couldn't|has|hasn’t|hasn't|counts|downloads|unlocks|takes|tracks|uses|never|may|writes|drafted|drafts|learns|holds|ever|opens|itself|is|checks|remembers|runs|says|assumes|needs|stores|exported|backup|feedback|does|knows|shows)\b|(?:\b(?:in|for|Open|open|Pick|from|into|add|Add|Adding|with|about|Why)|›) kept\b(?![-.\w])|\bkept (?:—|·|home|collects)|\bkept%20|(?:—|:) kept$/g,
  ],
];

/**
 * Every "kept" in src/ that is not the brand, by the text it sits in. Each is
 * matched against the line, so the entry is the evidence for the reason.
 */
const ALLOWED: readonly { file: string; text: string; why: string }[] = [
  {
    file: 'src/app/screens/Home.tsx',
    text: 'Kept back so far',
    why: 'the verb: money kept back from shops, the hero’s running total of refunds',
  },
  {
    file: 'src/app/screens/Celebrate.tsx',
    text: 'Kept back so far',
    why: 'the verb: the same running total, on the celebration after a refund',
  },
  {
    file: 'src/app/win-card.ts',
    text: "'Kept back so far'",
    why: 'the verb: the same running total, drawn on the shareable win card',
  },
  {
    file: 'src/app/components/ReceiptPhoto.tsx',
    text: 'it has not been kept.',
    why: 'the verb at the end of a sentence: a photo that could not be saved was not kept',
  },
];

interface Hit { file: string; line: number; shape: string; text: string }

const hits: Hit[] = sourceFiles(SRC).flatMap((path) => {
  const file = relative(ROOT, path).split('\\').join('/');
  return stripComments(readFileSync(path, 'utf8'))
    .split('\n')
    .flatMap((text, i) =>
      SHAPES.flatMap(([shape, re]) => [...text.matchAll(re)].map(() => ({ file, line: i + 1, shape, text: text.trim() }))),
    );
});

const excused = (h: Hit) => ALLOWED.some((a) => a.file === h.file && h.text.includes(a.text));

describe('the old name, kept, in what a person can read', () => {
  it('finds what it is meant to be checking', () => {
    // A sweep over no files, or with patterns that match nothing, passes
    // silently. The allowed verb uses are real matches, so they prove both.
    expect(sourceFiles(SRC).length).toBeGreaterThan(50);
    expect(hits.length).toBeGreaterThanOrEqual(ALLOWED.length);
  });

  it('is not shown anywhere in src/, outside the verb uses listed here', () => {
    const left = hits.filter((h) => !excused(h)).map((h) => `${h.file}:${h.line} ${h.shape} — ${h.text.slice(0, 120)}`);
    expect(left).toEqual([]);
  });

  it.each(ALLOWED)('still needs its exemption: $file "$text"', (a) => {
    expect(a.why.length).toBeGreaterThan(20);
    expect(hits.some((h) => h.file === a.file && h.text.includes(a.text))).toBe(true);
  });

  it('tells the brand from the verb in the cases that decide it', () => {
    const shaped = (s: string) => SHAPES.some(([, re]) => new RegExp(re.source).test(s));
    for (const brand of ['kept.', "fillText('kept.', pad, 170)", 'Kept reads the store', 'Something in kept broke', 'Open kept', 'Kept’s own list', 'On My iPhone › kept, as', 'before anything else — kept', 'kept couldn’t read that photo']) {
      expect(shaped(brand), brand).toBe(true);
    }
    for (const word of ["localStorage.getItem('kept.v1')", "'kept.unlimited'", 'justKept: null', 'interface KeptState', "status === 'kept'", 'kept-receipts.json', 'a photo kept with each receipt', 'kept them aside', ', kept by the browser', 'Decided to keep it']) {
      expect(shaped(word), word).toBe(false);
    }
  });
});

describe('the name the system shows', () => {
  const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

  it('is Quids In under the icon, on iOS and on the home screen', () => {
    expect(read('capacitor.config.ts')).toMatch(/appName: 'Quids In'/);
    expect(read('ios', 'App', 'App', 'Info.plist')).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>Quids In<\/string>/);
    const manifest = JSON.parse(read('public', 'manifest.webmanifest')) as { name: string; short_name: string };
    expect(manifest.short_name).toBe('Quids In');
    expect(manifest.name).toMatch(/^Quids In\b/);
    expect(read('app', 'index.html')).toMatch(/apple-mobile-web-app-title" content="Quids In"/);
  });

  it('is Quids In in every page title, and in no title is it kept', () => {
    for (const page of [['index.html'], ['app', 'index.html'], ['privacy', 'index.html'], ['rights', 'index.html']]) {
      const title = read(...page).match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
      expect(title, page.join('/')).toContain('Quids In');
      expect(title, page.join('/')).not.toMatch(/\bkept\b/i);
    }
  });
});
