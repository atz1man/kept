import { describe, expect, it } from 'vitest';
import { keepStorage, storageNote } from '../src/lib/persist';

describe('asking the browser to keep the library', () => {
  it('asks when storage is not yet kept, and reports the answer', async () => {
    let asked = 0;
    const storage = { persisted: async () => false, persist: async () => (asked++, true) };
    expect(await keepStorage(storage)).toBe(true);
    expect(asked).toBe(1);
  });

  it('does not ask again once it is kept', async () => {
    let asked = 0;
    expect(await keepStorage({ persisted: async () => true, persist: async () => (asked++, true) })).toBe(true);
    expect(asked).toBe(0);
  });

  it('says no, without throwing, where the browser has no such thing or refuses', async () => {
    expect(await keepStorage(undefined)).toBe(false);
    expect(await keepStorage({} as never)).toBe(false);
    expect(await keepStorage({ persisted: async () => false, persist: async () => false })).toBe(false);
    expect(await keepStorage({ persisted: async () => { throw new Error('no'); }, persist: async () => true })).toBe(false);
  });
});

describe('what Settings says about it', () => {
  it('says the browser may clear the library only when it refused to keep it', () => {
    expect(storageNote(false)).toMatch(/can clear it when space runs low/);
    expect(storageNote(false)).toMatch(/Home Screen/);
    expect(storageNote(false)).toMatch(/backup/);
    // Kept, or not answered yet (and on iPhone, which never asks): nothing.
    expect(storageNote(true)).toBeNull();
    expect(storageNote(null)).toBeNull();
  });
});
