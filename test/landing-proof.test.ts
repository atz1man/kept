import { describe, expect, it } from 'vitest';
import { proofFacts } from '../src/landing/proof';
import { CHECKED_ON, STORE_COUNT, checkedCount } from '../src/lib/stores';
import { CHRISTMAS } from '../src/lib/christmas';
import { COOLING_OFF_DAYS, REJECT_DAYS } from '../src/lib/legal';
import { addDays, fromISODate } from '../src/lib/dates';

/*
 * The landing page's proof section (src/landing/proof.ts). Every figure is the
 * app's own, computed on the day the page is opened — so the claim it makes
 * shrinks as checks go stale and the Christmas dates pass, rather than
 * standing there being true once.
 */
const at = (iso: string) => fromISODate(iso);
const figures = (d: Date) => proofFacts(d).map((f) => f.figure);

describe('the proof the landing page shows', () => {
  it('counts the shops with a current check, out of all of them, and says when the last was', () => {
    const today = at('2026-11-03');
    const { checked } = checkedCount(today);
    const [shops] = proofFacts(today);
    expect(shops.figure).toBe(checked === STORE_COUNT ? `${STORE_COUNT}` : `${checked} of ${STORE_COUNT}`);
    const latest = Object.values(CHECKED_ON).sort().at(-1)!;
    expect(shops.label).toContain(new Date(`${latest}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }));
  });

  it('takes the law’s two periods from the module that computes them', () => {
    expect(figures(at('2026-11-03'))).toContain(`${REJECT_DAYS} + ${COOLING_OFF_DAYS}`);
  });

  it('counts the Christmas dates still to come, and drops the figure once none is', () => {
    const shown = (d: Date) => proofFacts(d).find((f) => /Christmas/.test(f.label))?.figure;
    expect(shown(at('2026-11-03'))).toBe(`${CHRISTMAS.length}`);
    const last = CHRISTMAS.map((x) => x.returnBy).sort().at(-1)!;
    expect(shown(at(last))).toBe(`${CHRISTMAS.filter((x) => x.returnBy === last).length}`);
    expect(shown(addDays(at(last), 1))).toBeUndefined();
  });

  it('drops the shop figure rather than claim "0 of" anything once every check has gone stale', () => {
    const later = addDays(at(Object.values(CHECKED_ON).sort().at(-1)!), 400);
    expect(checkedCount(later).checked).toBe(0);
    expect(figures(later).some((f) => /of \d+$/.test(f) || f === `${STORE_COUNT}`)).toBe(false);
  });

  it('claims nothing about users, ratings or downloads', () => {
    for (const f of proofFacts(at('2026-11-03'))) {
      const text = `${f.figure} ${f.label}`;
      expect(text).not.toMatch(/★|rating|review|download|users|customers|recovered/i);
    }
  });
});
