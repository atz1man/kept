import { describe, expect, it } from 'vitest';
import { chooseSource, isNative, looksLikeState, writeMirror } from '../src/lib/mirror';

const library = (n: number) =>
  JSON.stringify({ version: 1, receipts: Array.from({ length: n }, (_, i) => ({ id: `r${i}` })) });

describe('what counts as a stored library', () => {
  it('accepts one', () => {
    expect(looksLikeState(library(3))).toBe(true);
  });

  it('accepts an EMPTY one, which is the whole point', () => {
    // An erased library is still a library. If this said false, the mirror
    // would be consulted after an erase and would hand the receipts back.
    expect(looksLikeState(library(0))).toBe(true);
  });

  it.each([[null], [''], ['not json'], ['{"receipts":'], ['null'], ['"a string"'], ['[]'], ['{"a":1}']])(
    'rejects %j',
    (raw) => {
      expect(looksLikeState(raw)).toBe(false);
    },
  );
});

describe('which copy the app boots from', () => {
  it('takes the live store whenever it can be read', () => {
    // The mirror is written after it, so it is at best equally fresh.
    expect(chooseSource(library(3), library(9))).toBe('local');
  });

  it('reaches for the mirror when the web view handed back nothing', () => {
    // The iOS failure this exists for: the data was reclaimed, not deleted.
    expect(chooseSource(null, library(3))).toBe('mirror');
  });

  it('reaches for the mirror when the live store is corrupt', () => {
    /*
     * The case worth having. Without a mirror, `load` meets unparseable JSON
     * and starts clean — the only sane thing it can do on its own, and still
     * every receipt gone.
     */
    expect(chooseSource('{"receipts":', library(3))).toBe('mirror');
  });

  it('starts fresh when neither copy is a library', () => {
    expect(chooseSource(null, null)).toBe('fresh');
    expect(chooseSource('junk', 'junk')).toBe('fresh');
  });

  it('starts fresh rather than trusting a mirror that is not a library', () => {
    expect(chooseSource(null, 'junk')).toBe('fresh');
  });

  /*
   * The trap this whole module could have walked into.
   *
   * Erasing does not remove the store — the reducer empties the library and
   * the save effect commits that, so what is left on disk is a valid state
   * holding no receipts. If an empty library did not count as readable, this
   * would fall through to the mirror and hand back everything the person just
   * asked to be rid of, on the next launch, with no way to tell them why.
   */
  it('never resurrects an erased library from the mirror', () => {
    expect(chooseSource(library(0), library(12))).toBe('local');
  });
});

describe('the two answers the web build must give', () => {
  /*
   * Both of these are one line of guard each, and both survived mutation
   * because nothing had ever asked. They are what makes the whole native half
   * inert off-device, which is the promise this file opens with.
   */
  it('is not native where there is no window at all', () => {
    // Every native path is gated on this, so a throw here would take down
    // whatever called it rather than quietly answering no.
    expect(typeof window).toBe('undefined');
    expect(isNative()).toBe(false);
  });

  it('reports that a mirror write did NOT land, when there is no mirror', async () => {
    // The function says it returns whether the write landed. On the web
    // nothing landed, and `false` is that answer rather than a placeholder.
    expect(await writeMirror('{"receipts":[]}')).toBe(false);
  });
})
