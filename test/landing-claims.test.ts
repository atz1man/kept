import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STORE_COUNT, STORE_POLICIES, findStore } from '../src/lib/stores';
import { COOLING_OFF_DAYS, REJECT_DAYS } from '../src/lib/legal';

/**
 * The landing page quotes the table, and only the numbers were held to it.
 *
 * `Landing.tsx` derives three windows through `days(name)`, which falls back
 * to zero for a shop it cannot find — the same silent default the ticker had,
 * on the more prominent surface. And two claims beside them are not derived at
 * all: "Zara's clock starts at dispatch" and "Uniqlo won't refund online
 * orders in store" are restatements of `clockStart` and of a gotcha, sitting
 * two lines under a comment about exactly this hazard.
 *
 * The README's own pre-ship task is to check all twenty windows against each
 * retailer's published terms. Whoever does that changes `stores.ts`, and
 * nothing was stopping the hero from going on saying the old thing — or, if a
 * name changed, from saying "IKEA's 0 days" on the page whose whole claim is
 * that kept knows the real one.
 *
 * Read from the source rather than through a render, which is this
 * repository's way with .tsx — see `placeholders.test.ts` and
 * `safe-area.test.ts`.
 */
const LANDING = readFileSync(join(__dirname, '..', 'src', 'landing', 'Landing.tsx'), 'utf8');

/** Every shop the page asks the table about, by literal. */
const quoted = (): string[] => [...LANDING.matchAll(/\bdays\('([^']+)'\)/g)].map((m) => m[1]);

describe('the shops the landing page names', () => {
  it('finds the ones it is meant to be checking', () => {
    // A sweep over an empty list passes silently, reporting success for a
    // question it never asked.
    expect(quoted().length).toBeGreaterThanOrEqual(3);
  });

  it('are all in the table it claims to be quoting', () => {
    for (const name of quoted()) {
      expect(findStore(name), name).toBeDefined();
    }
  });

  it('never leaves a window at the fallback', () => {
    // `days()` answers 0 for a shop it cannot find, and the hero would read
    // "IKEA’s 0 days" without a word of complaint.
    for (const name of quoted()) {
      expect(findStore(name)!.windowDays, name).toBeGreaterThan(0);
    }
  });
});

describe('the claims beside them, which are not derived', () => {
  it('says Zara counts from dispatch only while Zara does', () => {
    // The one shop in the table whose clock does not start at purchase, and
    // the reason a Zara coat can be out of time on the day it feels like it
    // arrived. If that entry changes, the hero is telling people the wrong
    // thing about the wrong shop.
    expect(LANDING).toContain('Zara’s clock starts at dispatch');
    expect(findStore('Zara')?.clockStart).toBe('dispatch');
  });

  it('says Uniqlo refuses in-store refunds only while its gotcha does', () => {
    expect(LANDING).toMatch(/Uniqlo won’t refund online orders in store/);
    const gotcha = findStore('Uniqlo')?.gotcha ?? '';
    expect(gotcha).toMatch(/will not refund an online order at the till/);
  });

  it('counts the shops from the table rather than from memory', () => {
    // STORE_COUNT is imported and interpolated, so this is a guard on the
    // import surviving rather than on the number — but a hardcoded twenty
    // appearing beside it is the drift worth catching.
    expect(LANDING).toContain('STORE_COUNT');
    expect(STORE_COUNT).toBe(STORE_POLICIES.length);
  });
});

describe('the statutory numbers the page quotes', () => {
  /*
   * The two the whole legal half of the product turns on, and they were prose
   * on the landing page while `legal.ts` computed from private constants —
   * beside three shop windows that had already been made derived for exactly
   * this reason.
   *
   * These ARE pinned as literals, unlike `MAX_PER_WAKE` or `MAX_UPDATES`,
   * because they are not thresholds we chose. Parliament chose them, and the
   * same call was made for `MAX_PENDING` at 64 because that is iOS's and
   * `AA_TEXT` at 4.5 because that is WCAG's. A test that let these drift would
   * be letting the app misstate somebody's rights.
   */
  it('is the Consumer Rights Act 2015 s.22 short-term right to reject: 30 days', () => {
    expect(REJECT_DAYS).toBe(30);
  });

  it('is the Consumer Contracts Regulations 2013 cancellation period: 14 days', () => {
    expect(COOLING_OFF_DAYS).toBe(14);
  });

  it('takes them from that module rather than typing them again', () => {
    // The prose said "30 days" and "14-day" as literals. Interpolated now, so
    // the page cannot disagree with the screen computing the same deadline.
    expect(LANDING).toContain('${REJECT_DAYS} days to reject');
    expect(LANDING).toContain('${COOLING_OFF_DAYS}-day cooling-off');
  });
})
