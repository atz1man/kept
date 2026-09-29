import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "`CONTACT_EMAIL` in `src/privacy/Privacy.tsx`" — a pointer a person follows.
 *
 * The submission checklist sent whoever fills in the contact address to the
 * privacy page, and the constant had moved to `src/lib/brand.ts` when Settings
 * needed it too. The person opening that file would have found an import, not
 * a line to edit — on the checklist whose whole job is to be followed without
 * thinking. TESTFLIGHT.md, written later, had the right file; the older page
 * was simply never revisited.
 *
 * So every "`NAME` in `file`" in the repository's own documents is checked:
 * the file exists and the name is DECLARED there. Merely appearing is not
 * enough, and that was found by running it: the privacy page still imports
 * `CONTACT_EMAIL`, so "the file mentions it" passed the very pointer this was
 * written for. In code the name must be bound (`const NAME`); in anything else
 * (`REPLACE_ME` in the listing) it must appear. Prose around it is left alone.
 * A bare filename (`a11y.mjs`) is accepted when exactly one file has it.
 */
const ROOT = join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'ios', 'android', 'coverage']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const tree = walk(ROOT);
const docs = tree.filter((f) => f.endsWith('.md'));

/** Every pointer in a piece of Markdown: the name and the file it is said to be in. */
export function pointers(markdown: string): { name: string; file: string }[] {
  return [...markdown.matchAll(/`([A-Z][A-Z0-9_]{3,})` in `([^`\s]+\.[a-z]+)`/g)]
    .map((m) => ({ name: m[1], file: m[2] }));
}

/** Whether a file is where a name lives, rather than somewhere it is used. */
export function declares(path: string, source: string, name: string): boolean {
  if (!/\.(?:tsx?|mjs|js)$/.test(path)) return source.includes(name);
  return new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b`).test(source);
}

function resolve(file: string): string | null {
  if (existsSync(join(ROOT, file))) return join(ROOT, file);
  if (file.includes('/')) return null;
  const hits = tree.filter((f) => basename(f) === file);
  return hits.length === 1 ? hits[0] : null;
}

describe('pointers in the documents', () => {
  const all = docs.flatMap((doc) =>
    pointers(readFileSync(doc, 'utf8')).map((p) => ({ ...p, doc: doc.slice(ROOT.length + 1) })));

  it('finds the pointers it is meant to be checking', () => {
    // A matcher that stopped matching would check nothing and pass.
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(all.some((p) => p.name === 'CONTACT_EMAIL')).toBe(true);
  });

  it('reads a pointer and nothing around it', () => {
    expect(pointers('set `CONTACT_EMAIL` in `src/lib/brand.ts` first')).toEqual([
      { name: 'CONTACT_EMAIL', file: 'src/lib/brand.ts' },
    ]);
    expect(pointers('`npm run preflight` in `package.json`')).toEqual([]);
  });

  it('tells a declaration from an import', () => {
    expect(declares('a.ts', 'export const CONTACT_EMAIL: string | null = null;', 'CONTACT_EMAIL')).toBe(true);
    expect(declares('a.mjs', 'const SEED_MORE = () => {', 'SEED_MORE')).toBe(true);
    expect(declares('a.tsx', "import { CONTACT_EMAIL } from '../lib/brand';", 'CONTACT_EMAIL')).toBe(false);
    expect(declares('a.tsx', '{CONTACT_EMAIL && <a/>}', 'CONTACT_EMAIL')).toBe(false);
    expect(declares('a.json', '"https://REPLACE_ME/privacy/"', 'REPLACE_ME')).toBe(true);
  });

  it('each name a file that exists and declares the name', () => {
    const wrong = all
      .filter((p) => {
        const path = resolve(p.file);
        return path === null || !declares(path, readFileSync(path, 'utf8'), p.name);
      })
      .map((p) => `${p.doc}: ${p.name} in ${p.file}`);
    expect(wrong).toEqual([]);
  });
});
