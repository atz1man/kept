import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The README's layout block, against the tree it claims to describe.
 *
 * It listed thirteen of the twenty-six modules in `src/lib` with nothing
 * marking it partial, so a reader was handed half the territory as though it
 * were the whole of it — `mirror.ts`, `save-file.ts`,
 * `schedule.ts` and `feed-signature.ts` among the missing, which is most of
 * what the iOS work added. Nobody deleted anything; the map simply stopped
 * being updated, which is the same shape as the correction that stopped at one
 * surface, and the same shape as the privacy manifest the README went on
 * calling unwritten for as long as it existed.
 *
 * Prose cannot be checked, but a list of filenames can, so this checks the
 * list and leaves the sentences alone. It walks the real directory rather than
 * a hand-kept copy of it, so the twenty-sixth module is covered on the day it
 * is written — which is the point, since the failure mode here is precisely
 * that somebody adds a file and does not come back here.
 */
const ROOT = join(__dirname, '..');
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');
const BLOCK = /## Layout\n+```\n([\s\S]*?)```/.exec(README)?.[1] ?? '';

/** The entries indented under `src/lib/`, which is where the modules are listed. */
const listed = [...BLOCK.matchAll(/^ {2}([\w-]+\.ts)/gm)].map((m) => m[1]);
const onDisk = readdirSync(join(ROOT, 'src', 'lib')).filter((f) => f.endsWith('.ts'));

const NUMBERS: Record<string, number> = {
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
};

describe('the README layout block', () => {
  it('finds the map it is meant to be reading', () => {
    // A block that stopped matching — renamed heading, fence moved — would
    // leave every check below comparing two empty lists and passing.
    expect(BLOCK).toContain('src/lib/');
    expect(listed.length).toBeGreaterThan(20);
    expect(onDisk.length).toBeGreaterThan(20);
  });

  it('names every module in src/lib', () => {
    const missing = onDisk.filter((f) => !listed.includes(f));
    expect(missing, `in src/lib but not on the map: ${missing.join(', ')}`).toEqual([]);
  });

  it('names nothing that is not there', () => {
    const gone = listed.filter((f) => !onDisk.includes(f));
    expect(gone, `on the map but not in src/lib: ${gone.join(', ')}`).toEqual([]);
  });

  it('counts the screens it says there are', () => {
    // "src/app/  the eight screens and their chrome" — a number in prose, with
    // a directory that can answer it.
    const said = /src\/app\/\s+the (\w+) screens/.exec(BLOCK)?.[1];
    expect(said, 'the block no longer names a screen count').toBeTruthy();
    expect(NUMBERS[said!], `"${said}" is not a number this test knows`).toBeTypeOf('number');
    const screens = readdirSync(join(ROOT, 'src', 'app', 'screens')).filter((f) => f.endsWith('.tsx'));
    expect(screens.length, `the README says ${said}, the directory holds ${screens.length}`)
      .toBe(NUMBERS[said!]);
  });
});
