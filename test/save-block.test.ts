import { describe, expect, it } from 'vitest';
import { SAVE_LABEL, saveBlock } from '../src/lib/save-block';

const ready = { quotaFull: false, distance: false as boolean | null, needsStore: false, needsTotal: false };

describe('what stops the Add card saving', () => {
  it('saves a card with every answer it needs', () => {
    expect(saveBlock(ready)).toBeNull();
    expect(saveBlock({ ...ready, distance: true })).toBeNull();
    expect(SAVE_LABEL.none).toBe('Save receipt');
  });

  it('refuses a card that has not said where it was bought, rather than assuming online', () => {
    // An unanswered card used to save as "Online or phone", which promised a
    // 14-day right to cancel for a purchase made over a counter.
    expect(saveBlock({ ...ready, distance: null })).toBe('how');
    expect(SAVE_LABEL.how).toBe('Say where you bought it');
  });

  it('refuses a paste with no shop, so no letter opens "Dear Unknown store,"', () => {
    expect(saveBlock({ ...ready, needsStore: true })).toBe('store');
    expect(SAVE_LABEL.store).toBe('Add the shop to save');
  });

  it('names a purchase date in the future, instead of a greyed-out "Save receipt"', () => {
    const block = saveBlock({ ...ready, boughtError: 'That date is in the future.' });
    expect(block).toBe('bought');
    expect(SAVE_LABEL[block!]).not.toBe(SAVE_LABEL.none);
  });

  it('asks top to bottom: the shop before where it was bought, then the total', () => {
    expect(saveBlock({ ...ready, needsStore: true, distance: null, needsTotal: true })).toBe('store');
    expect(saveBlock({ ...ready, distance: null, needsTotal: true })).toBe('how');
    expect(saveBlock({ ...ready, needsTotal: true, windowError: 'x' })).toBe('total');
    expect(saveBlock({ ...ready, quotaFull: true, needsStore: true })).toBe('quota');
  });

  it('gives every refusal a label of its own', () => {
    const labels = Object.values(SAVE_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
