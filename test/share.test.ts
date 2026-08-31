import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../src/lib/parse';
import { shareRoute, sharedTextFrom } from '../src/lib/share';

const q = (s: string) => new URLSearchParams(s);

describe('receiving a shared order email', () => {
  it('is nothing when no share params are present', () => {
    expect(sharedTextFrom(q(''))).toBeNull();
    expect(sharedTextFrom(q('embed=1'))).toBeNull();
  });

  it('takes the body when that is all that was sent', () => {
    expect(sharedTextFrom(q('text=Your+Apple+order'))).toBe('Your Apple order');
  });

  it('keeps the subject, where the shop name usually is', () => {
    const text = sharedTextFrom(q('title=Your+Zara+order&text=Total+%C2%A334.99'))!;
    expect(text).toContain('Zara');
    expect(text).toContain('£34.99');
  });

  it('folds all three parts together', () => {
    expect(sharedTextFrom(q('title=A&text=B&url=https%3A%2F%2Fc'))).toBe('A\nB\nhttps://c');
  });

  it('does not repeat a part the sharing app sent twice', () => {
    // Android commonly sends the same string as both text and url; a doubled
    // total is exactly what confuses a parser looking for the largest amount.
    expect(sharedTextFrom(q('text=Total+%C2%A3129.00&url=Total+%C2%A3129.00'))).toBe('Total £129.00');
  });

  it('ignores empty and whitespace-only parts', () => {
    expect(sharedTextFrom(q('title=+++&text=Currys+%C2%A389'))).toBe('Currys £89');
  });

  it('hands the parser something it can actually read', () => {
    const shared = sharedTextFrom(q('title=Your+Currys+order&text=Total+%C2%A389.00+%C2%B7+16+Aug'))!;
    const out = parseReceiptText(shared, new Date(2026, 7, 28));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.store).toBe('Currys');
      expect(out.value.amount).toBe(8900);
      expect(out.value.purchasedOn).toBe('2026-08-16');
    }
  });
});

describe('what the Add screen teaches about sharing', () => {
  it('does not draw the three steps in the iOS app', () => {
    /*
     * The steps are a promise about the device reading them — open the order,
     * tap share, pick kept. A Capacitor app appears in the iOS share sheet
     * only if it ships a share extension target, and ios/App has none, so in
     * the native build those steps end at a sheet kept is not in.
     */
    expect(shareRoute(true).steps).toBe(false);
  });

  it('sends someone in the iOS app to the paste box instead', () => {
    const route = shareRoute(true);
    expect(route.body).toMatch(/paste/i);
    // And says why, rather than leaving a capability quietly missing.
    expect(route.body).toMatch(/share extension/i);
  });

  it('names the platform the share sheet route works on, rather than guessing', () => {
    /*
     * Web Share Target is Chromium's and there is no feature test for it: the
     * manifest entry is read at install time and nothing in the page can ask
     * whether it was honoured. Naming Android is the claim that cannot be
     * wrong in the harmful direction — an iPhone told it works there is a
     * dead end, an Android phone told nothing loses a shortcut.
     */
    const route = shareRoute(false);
    expect(route.steps).toBe(true);
    expect(route.body).toMatch(/android/i);
    expect(route.body).toMatch(/iphone/i);
  });

  it('never promises the share sheet unconditionally', () => {
    // The defect in one line: the old copy said "add kept to your home screen
    // and it appears in the share sheet" to every platform.
    for (const native of [true, false]) {
      const body = shareRoute(native).body;
      const promisesSheet = /share sheet/i.test(body);
      if (promisesSheet) expect(body).toMatch(/android/i);
    }
  });
});
