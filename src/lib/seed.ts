import { addDays, toISODate } from './dates';
import { toPence } from './money';
import type { PolicyUpdate, Receipt } from './types';

/**
 * The first-run demo set, anchored to the day the app is opened rather than
 * to fixed calendar dates: a screenshot taken in six months has to show the
 * same "2 days left" urgency the design does, not five receipts long expired.
 */
export function seedReceipts(today: Date): Receipt[] {
  const ago = (n: number) => toISODate(addDays(today, -n));
  return [
    {
      id: 'seed_currys', store: 'Currys', item: 'JBL Tune 770NC headphones', cat: 'audio',
      amount: toPence(89.0), purchasedOn: ago(12), windowDays: 14,
      policy: 'Currys · 14 days change of mind, unopened or unwanted. Refund to original payment method.',
      distance: false, warranty: { months: 24, note: 'Manufacturer warranty — repairs free within it' },
      status: 'active', demo: true,
    },
    {
      id: 'seed_argos', store: 'Argos', item: 'Kenwood kMix stand mixer', cat: 'kitchen',
      amount: toPence(64.99), purchasedOn: ago(21), windowDays: 30,
      policy: 'Argos · 30 days with proof of purchase. Return to any store or arrange collection.',
      distance: false, warranty: { months: 12, note: 'Kenwood guarantee' }, status: 'active', demo: true,
    },
    {
      // The dispatch gotcha as data, not prose: the order was placed two days
      // before the parcel left the warehouse, and Zara counts from the later
      // of those — which is what makes the detail screen's warning true.
      id: 'seed_zara', store: 'Zara', item: 'Wool-blend overcoat', cat: 'clothing',
      amount: toPence(34.99), purchasedOn: ago(15), windowStartsOn: ago(13), windowDays: 30,
      policy: 'Zara · 30 days from dispatch, not delivery. Postal returns now £1.95 — in-store drop-off still free.',
      // Ordered online and dispatched, so this one carries BOTH rights —
      // the only seeded receipt that does, which is what makes the detail
      // screen's two-right case reachable from a fresh install.
      distance: true,
      gotcha: 'Zara counts the 30 days from dispatch, not from the day the parcel landed on your mat — the clock had already been running when it arrived.',
      status: 'active', demo: true,
    },
    {
      id: 'seed_boots', store: 'Boots', item: 'No7 skincare set', cat: 'beauty',
      amount: toPence(24.98), purchasedOn: ago(14), windowDays: 35,
      policy: 'Boots · 35 days, unopened, with receipt. Advantage Card refunds go back as points.',
      distance: false, status: 'active', demo: true,
    },
    {
      id: 'seed_ikea', store: 'IKEA', item: 'MALM chest of 6 drawers', cat: 'furniture',
      amount: toPence(199.0), purchasedOn: ago(195), windowDays: 365,
      policy: 'IKEA · 365 days, even assembled, with proof of purchase. 14 days for cut fabric.',
      distance: false, warranty: { months: 120, note: '10-year guarantee on MALM frames' }, status: 'active', demo: true,
    },
  ];
}

/**
 * Sample policy changes, so a first launch is not an empty Watch tab.
 *
 * SAMPLES, and labelled as such (`demo`), exactly like the receipts above.
 * They used to be described as "the offline fallback for the policy feed",
 * carried the same ids as `public/policy-feed.json`, and that file called
 * itself "Verified UK retailer policy changes" — while nobody had checked a
 * single one against the retailer. Five claims about named companies, shown
 * as dated news on every install.
 *
 * So they are illustrations of what a change looks like when it lands, and
 * the code holds them to that: a sample only ever speaks to a sample receipt
 * (`speaksTo`), never sets the window of a real purchase (`windowInForceFor`),
 * and is dropped the moment a real change arrives (`mergeFeed`). Dates are
 * relative so the tab looks alive on any day it is opened — which is fine for
 * a sample and would be a lie for news.
 */
export function seedUpdates(today: Date): PolicyUpdate[] {
  const ago = (n: number) => toISODate(addDays(today, -n));
  return [
    {
      id: 'u_zara_postal_returns_fee', store: 'Zara', changedOn: ago(2),
      text: 'Free postal returns ended — £1.95 unless you drop off in store. Window still 30 days from dispatch.',
      affectsStores: ['Zara'], affectNote: 'drop off in store to keep it free', newWindowDays: 30, demo: true,
    },
    {
      id: 'u_asos_frequent_returners', store: 'ASOS', changedOn: ago(7),
      text: 'New 28-day window for “frequent returners” (was 45). ASOS decides who counts, so Kept assumes the shorter one.',
      affectsStores: ['ASOS'], affectNote: 'your window is the shorter one', newWindowDays: 28, demo: true,
    },
    {
      id: 'u_apple_iphone18_window', store: 'Apple', changedOn: ago(21),
      text: '14-day window confirmed for the iPhone 18 line. Put the warranty length on the receipt and Kept counts that down too.',
      affectsStores: ['Apple'], affectNote: 'confirmed at 14 days', newWindowDays: 14, demo: true,
    },
    {
      id: 'u_currys_price_match', store: 'Currys', changedOn: ago(30),
      text: 'Price-match refund window extended to 14 days — if it drops in price after you buy, claim the difference.',
      affectsStores: ['Currys'], affectNote: 'you can claim the difference if the price drops', newWindowDays: 14, demo: true,
    },
    {
      id: 'u_uniqlo_online_refunds', store: 'Uniqlo', changedOn: ago(46),
      text: 'Online orders can no longer be refunded in store — postal returns only. In-store purchases are unaffected.',
      affectsStores: ['Uniqlo'], affectNote: 'an online order has to go back by post', newWindowDays: 30, demo: true,
    },
  ];
}
