import { daysBetween, fmtDateLong, fromISODate } from './dates';
import type { Category } from './types';

/**
 * The verified UK retailer policy table.
 *
 * This is the app's product, not a lookup convenience: the whole pitch is
 * that Kept knows each shop's REAL window and the trap inside it. Every entry
 * carries the window, the wording a user would need at the counter, and — the
 * part that actually saves money — where the clock starts. `clockStart:
 * 'dispatch'` is why a Zara coat can be out of time on the day it feels like
 * day 20.
 */
export interface StorePolicy {
  /** Canonical display name. */
  name: string;
  /** Lowercase strings that identify this retailer in a pasted order email. */
  aliases: string[];
  windowDays: number;
  policy: string;
  /**
   * Where the RETAILER's own window starts counting — which is not always the
   * till.
   *
   * Three values because three things happen: the thing is bought, it leaves
   * the warehouse, it lands on the mat. Zara counts from the second, Apple,
   * Amazon and ASOS from the third, everyone else from the first. This was a
   * two-value field read by nothing at all, while three of the entries below
   * carried a `gotcha` explaining in prose that they count from delivery and
   * the app could not.
   *
   * Distinct from `Receipt.arrivedOn`, which is a FACT about one parcel. This
   * is a RULE about a shop, and a shop does not change which of the three it
   * counts from the way it changes how many days it gives — which is why
   * reading it from the table at render time is right where re-reading the
   * window would not be.
   */
  clockStart: 'purchase' | 'dispatch' | 'delivery';
  /**
   * Where the clock starts for an ONLINE order, when that is not `clockStart`.
   *
   * One clock per shop was a simplification the table could not hold: many
   * shops count an in-store purchase from the till and an online order from
   * the day it arrives. With one field, those online orders counted from the
   * order — the safe direction, but a window closed on a day the shop would
   * still take the thing back.
   *
   * Set ONLY from the retailer's own page (`npm run check:retailers`), never
   * from a search result: setting it can only lengthen a window, which is the
   * direction this app must never guess in. Until a page says so, it is unset
   * and the shop runs one clock.
   */
  onlineClockStart?: 'purchase' | 'dispatch' | 'delivery';
  gotcha?: string;
  /**
   * True when this shop's name is also an ordinary word a receipt might use
   * for something else — "next day delivery", "walking boots".
   *
   * Those three retailers are why the paste parser will not name a shop on a
   * bare mention of their alias: a Vinted order for walking boots was reported
   * as a Boots purchase, with Boots' 35-day window and Boots' policy wording
   * quoted at the counter. Naming no shop is a flagged assumption on screen;
   * naming the wrong one is a confident lie. See `pickStore` in parse.ts for
   * what it takes to count instead.
   */
  commonWord?: boolean;
  /** Typical category, used to pick a row icon when nothing better is known. */
  cat?: Category;
}

export const STORE_POLICIES: readonly StorePolicy[] = [
  {
    name: 'Apple', commonWord: true, aliases: ['apple'], windowDays: 14, clockStart: 'delivery', cat: 'audio',
    policy: 'Apple · 14 days from delivery, any reason, original condition and packaging. Refund to the original payment method.',
    gotcha: 'Apple counts the 14 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Amazon', aliases: ['amazon'], windowDays: 30, clockStart: 'delivery',
    policy: 'Amazon · 30 days from delivery for most items. Some categories (opened software, groceries) are excluded.',
    gotcha: 'Amazon counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Currys', aliases: ['currys', 'pc world'], windowDays: 14, clockStart: 'purchase', cat: 'audio',
    policy: 'Currys · 14 days change of mind, unopened or unwanted. Refund to original payment method.',
  },
  {
    name: 'Argos', aliases: ['argos'], windowDays: 30, clockStart: 'purchase', cat: 'kitchen',
    policy: 'Argos · 30 days with proof of purchase. Return to any store or arrange collection.',
  },
  {
    name: 'IKEA', aliases: ['ikea'], windowDays: 365, clockStart: 'purchase', cat: 'furniture',
    policy: 'IKEA · 365 days, even assembled, with proof of purchase. 14 days for cut fabric.',
    gotcha: 'Cut fabric, plants and custom worktops get 14 days, not 365 — the long window does not cover them.',
  },
  {
    name: 'Zara', aliases: ['zara'], windowDays: 30, clockStart: 'dispatch', cat: 'clothing',
    policy: 'Zara · 30 days from dispatch, not delivery. Postal returns now £1.95 — in-store drop-off still free.',
    gotcha: 'Zara counts from the day the parcel is dispatched, not the day it arrives — the window is already running when it lands.',
  },
  {
    name: 'Boots', commonWord: true, aliases: ['boots'], windowDays: 35, clockStart: 'purchase', cat: 'beauty',
    policy: 'Boots · 35 days, unopened, with receipt. Advantage Card refunds go back as points.',
  },
  {
    name: 'Uniqlo', aliases: ['uniqlo'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Uniqlo · 30 days, unwashed and unused with tags: from purchase in store, from delivery online. Online orders are refunded by post only.',
    gotcha: 'Uniqlo will not refund an online order at the till — it has to go back by post. An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'ASOS', aliases: ['asos'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'ASOS · 28 days from delivery for a refund, 45 for credit. Frequent returners get the shorter window.',
    gotcha: 'ASOS counts the 28 days from the day it arrives, not from your order — put the arrival date on the receipt and kept counts from there. After 28 days it is credit, not a refund.',
  },
  {
    name: 'Next', commonWord: true, aliases: ['next'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'Next · 28 days for a full refund to the way you paid, unworn with tags.',
    gotcha: 'After the 28 days Next still takes it back, but as an eVoucher, not a refund.',
  },
  {
    name: 'John Lewis', aliases: ['john lewis'], windowDays: 35, clockStart: 'purchase',
    policy: 'John Lewis · 35 days with proof of purchase, unused and in original packaging.',
  },
  {
    name: 'M&S', aliases: ['m&s', 'marks and spencer', 'marks & spencer'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'M&S · 28 days with receipt, unworn with labels (sale items 14): from purchase in store, from delivery online. Food and bought-in-store bras excluded.',
    gotcha: 'Sale items get 14 days, not 28. An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'H&M', aliases: ['h&m', 'hennes'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'H&M · 28 days, unworn with tags and receipt. Online returns free to store.',
  },
  {
    name: 'Sports Direct', aliases: ['sports direct', 'sportsdirect'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'Sports Direct · 28 days from purchase. Bought in store, it comes back as a credit note or an exchange.',
    gotcha: 'Taken back to a store within the 28 days, you get a credit note or an exchange, not your money back.',
  },
  {
    name: 'Screwfix', aliases: ['screwfix'], windowDays: 30, clockStart: 'purchase',
    policy: 'Screwfix · 30 days, unused and in original packaging, to any branch.',
  },
  {
    name: 'B&Q', aliases: ['b&q', 'b and q'], windowDays: 90, clockStart: 'purchase', cat: 'furniture',
    policy: 'B&Q · 90 days with proof of purchase, unused. Cut timber and mixed paint excluded.',
    gotcha: 'Cut-to-size timber and colour-mixed paint are non-returnable, whatever the receipt says.',
  },
  {
    name: 'Wickes', aliases: ['wickes'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'furniture',
    policy: 'Wickes · 30 days, unused and in original packaging, with proof of purchase: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Decathlon', aliases: ['decathlon'], windowDays: 30, clockStart: 'purchase',
    policy: 'Decathlon · 30 days, unused with proof of purchase — 365 days for Decathlon members. Worn items assessed in store.',
    gotcha: 'The 365 days are for Decathlon members whose card was scanned when they paid; everyone else gets 30. If that was you, change the window on this receipt.',
  },
  {
    name: 'Sainsbury’s', aliases: ['sainsbury', 'sainsburys', 'sainsbury’s'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery',
    policy: 'Sainsbury’s · 30 days in original condition with proof of purchase: from purchase in store, from delivery (or collection) online.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Tesco', aliases: ['tesco'], windowDays: 30, clockStart: 'purchase',
    policy: 'Tesco · 30 days with receipt for non-food, in original condition.',
  },
  /*
   * Added 3 October 2026 from each shop's own returns page, read by
   * `npm run check:candidates`; the quotes are in
   * store/retailer-check/2026-10-03-candidates.md. Online orders count from
   * delivery only where the page says so in so many words.
   */
  {
    name: 'Lidl', aliases: ['lidl'], windowDays: 30, clockStart: 'purchase',
    policy: 'Lidl · non-food Specials bought in store: 30 days with your receipt if you change your mind.',
    gotcha: 'The 30 days are for non-food Specials bought in a Lidl store. Food is not covered by them.',
  },
  {
    name: 'Fenwick', aliases: ['fenwick'], windowDays: 14, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Fenwick · 14 days for a refund: from purchase in store, from delivery online. In store, full-price items on days 15 to 28 get a gift card or exchange.',
    gotcha: 'In store, full-price items brought back on days 15 to 28 get a Fenwick gift card or an exchange, not your money back. An online order counts the 14 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Debenhams', aliases: ['debenhams'], windowDays: 21, clockStart: 'delivery', cat: 'clothing',
    policy: 'Debenhams · 21 days from the day it arrives, for a refund or store credit.',
    gotcha: 'Debenhams counts the 21 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'River Island', aliases: ['river island', 'riverisland'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'River Island · 28 days: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Matalan', aliases: ['matalan'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Matalan · 28 days: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Boohoo', aliases: ['boohoo'], windowDays: 21, clockStart: 'delivery', cat: 'clothing',
    policy: 'Boohoo · 21 days from the day it arrives, for a refund or gift card.',
    gotcha: 'Boohoo counts the 21 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'PrettyLittleThing', aliases: ['prettylittlething', 'pretty little thing'], windowDays: 21, clockStart: 'delivery', cat: 'clothing',
    policy: 'PrettyLittleThing · tell them within 21 days from the day it arrives.',
    gotcha: 'PrettyLittleThing counts the 21 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Clarks', commonWord: true, aliases: ['clarks'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'Clarks · 28 days from delivery (sale items 14), unworn and in original condition.',
    gotcha: 'Sale items get 14 days, not 28. Clarks counts from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'White Stuff', commonWord: true, aliases: ['white stuff', 'whitestuff'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'White Stuff · 30 days (sale items 14): from purchase in store, from delivery online.',
    gotcha: 'Sale items get 14 days, and anything bought from a White Stuff outlet gets 14. An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Monsoon', commonWord: true, aliases: ['monsoon'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Monsoon · 30 days: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'AllSaints', commonWord: true, aliases: ['allsaints', 'all saints'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'AllSaints · 28 days after purchase, online or in store.',
  },
  {
    name: 'Nike', commonWord: true, aliases: ['nike'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Nike · most items within 30 days: from purchase in a Nike store, from delivery online.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Dunelm', aliases: ['dunelm'], windowDays: 28, clockStart: 'purchase', cat: 'furniture',
    policy: 'Dunelm · change your mind within 28 days of purchase, some exclusions.',
  },
  {
    name: 'B&M', aliases: ['b&m', 'b & m', 'bmstores'], windowDays: 30, clockStart: 'purchase',
    policy: 'B&M · 30 days in original condition with proof of purchase, for a refund or replacement.',
  },
  {
    name: 'Toolstation', aliases: ['toolstation'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery',
    policy: 'Toolstation · 30 days unused: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Habitat', commonWord: true, aliases: ['habitat'], windowDays: 30, clockStart: 'delivery', cat: 'furniture',
    policy: 'Habitat · 30 days from delivery (or collection) to ask for a return.',
    gotcha: 'Habitat counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'The Body Shop', aliases: ['the body shop', 'thebodyshop'], windowDays: 45, clockStart: 'delivery', cat: 'beauty',
    policy: 'The Body Shop · 45 days from delivery, with your receipt.',
    gotcha: 'The Body Shop counts the 45 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Lookfantastic', aliases: ['lookfantastic', 'look fantastic'], windowDays: 30, clockStart: 'delivery', cat: 'beauty',
    policy: 'Lookfantastic · start a return within 30 days from delivery, in pristine condition.',
    gotcha: 'Lookfantastic counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Holland & Barrett', aliases: ['holland & barrett', 'holland and barrett', 'hollandandbarrett'], windowDays: 30, clockStart: 'purchase', cat: 'beauty',
    policy: 'Holland & Barrett · 30 days from purchase, unopened with seals intact.',
  },
  {
    name: 'Go Outdoors', commonWord: true, aliases: ['go outdoors', 'gooutdoors'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Go Outdoors · 28 days: from purchase in store, from delivery (or collection) online. Refurbished items bought online get 14.',
    gotcha: 'Refurbished items bought online get 14 days from delivery, not 28. An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Pets at Home', aliases: ['pets at home', 'petsathome'], windowDays: 30, clockStart: 'purchase',
    policy: 'Pets at Home · 30 days with proof of purchase if you change your mind.',
  },
  /*
   * Added 3 October 2026, second reading: these shops' homepages refuse an
   * automated browser or hide the link, and their own returns pages, listed
   * in retailer-candidates.json, did not. Quotes in
   * store/retailer-check/2026-10-03-candidates-2.md.
   */
  {
    name: 'Aldi', aliases: ['aldi'], windowDays: 60, clockStart: 'purchase',
    policy: 'Aldi · 60 days to bring back anything bought in store for a refund.',
  },
  {
    name: 'FatFace', aliases: ['fatface', 'fat face'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'FatFace · 28 days from delivery (sale items 15), to your home or to a store.',
    gotcha: 'Sale items get 15 days, not 28. FatFace counts from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Richer Sounds', aliases: ['richer sounds', 'richersounds'], windowDays: 30, clockStart: 'purchase', cat: 'audio',
    policy: 'Richer Sounds · 30 days from purchase for a full refund if sealed and unused; opened items may carry a 10% handling fee.',
    gotcha: 'The full refund is for sealed boxes. Open it and a return in mint condition may lose 10% to a handling fee.',
  },
  {
    name: 'Samsung', commonWord: true, aliases: ['samsung'], windowDays: 14, clockStart: 'delivery', cat: 'audio',
    policy: 'Samsung · tell them within 14 days from delivery, then 14 more to send it back.',
    gotcha: 'Samsung counts the 14 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Selfridges', aliases: ['selfridges'], windowDays: 14, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Selfridges · 14 days: from purchase in store, from delivery (or collection) online.',
    gotcha: 'Sale or clearance items bought in store can come back within the 14 days for an exchange or gift card only. An online order counts the 14 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'The Works', commonWord: true, aliases: ['the works', 'theworks'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery',
    policy: 'The Works · 28 days with a receipt: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  /*
   * Added 3 October 2026, third reading: UK retailers new to the candidates
   * file, read from their own returns pages. Quotes in
   * store/retailer-check/2026-10-03-candidates-3.md.
   */
  {
    name: 'Card Factory', aliases: ['card factory', 'cardfactory'], windowDays: 28, clockStart: 'purchase',
    policy: 'Card Factory · 28 days from purchase with a receipt, in original condition and packaging, for an exchange or refund.',
  },
  {
    name: 'Seasalt', commonWord: true, aliases: ['seasalt', 'seasalt cornwall'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'Seasalt · 28 days from delivery under their voluntary promise.',
    gotcha: 'Seasalt counts the 28 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Mint Velvet', aliases: ['mint velvet', 'mintvelvet'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'Mint Velvet · 28 days for a full refund, unworn.',
  },
  {
    name: 'Hobbs', commonWord: true, aliases: ['hobbs'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Hobbs · 30 days with proof of purchase (sale items 14): from purchase in store, from delivery online.',
    gotcha: 'Sale items get 14 days, not 30. An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Whistles', commonWord: true, aliases: ['whistles'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Whistles · 28 days (sale items 14): from purchase in store, from delivery online. Refunds lose a £1.95 processing fee.',
    gotcha: 'Sale items get 14 days, not 28, and a refund comes back less a £1.95 processing fee. An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Jigsaw', commonWord: true, aliases: ['jigsaw'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Jigsaw · 28 days for full-price items: from purchase in store, from delivery online. Sale items 14 days from purchase.',
    gotcha: 'Sale items get 14 days, counted from the day you bought them, not 28. An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Boden', aliases: ['boden'], windowDays: 30, clockStart: 'delivery', cat: 'clothing',
    policy: 'Boden · 30 days from delivery in original condition (sale items 14).',
    gotcha: 'Sale items get 14 days, not 30. Boden counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Gymshark', aliases: ['gymshark'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Gymshark · 30 days in original condition: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Oliver Bonas', aliases: ['oliver bonas', 'oliverbonas'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery',
    policy: 'Oliver Bonas · most items within 30 days: from purchase in store, from delivery online, whichever is later.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Kurt Geiger', commonWord: true, aliases: ['kurt geiger', 'kurtgeiger'], windowDays: 30, clockStart: 'purchase', cat: 'clothing',
    policy: 'Kurt Geiger · 30 days from purchase for full-price unworn items (sale items 14).',
    gotcha: 'Sale items get 14 days, not 30.',
  },
  {
    name: 'Dune London', aliases: ['dune london', 'dunelondon'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'Dune London · 28 days for a refund, within their returns conditions.',
  },
  {
    name: 'Crew Clothing', aliases: ['crew clothing', 'crewclothing'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'Crew Clothing · 28 days from purchase (sale items 14), original condition with tags.',
    gotcha: 'Sale items get 14 days, not 28.',
  },
  {
    name: 'Peacocks', commonWord: true, aliases: ['peacocks'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Peacocks · 28 days with a receipt: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Cult Beauty', aliases: ['cult beauty', 'cultbeauty'], windowDays: 30, clockStart: 'delivery', cat: 'beauty',
    policy: 'Cult Beauty · 30 days from delivery, in pristine condition.',
    gotcha: 'Cult Beauty counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Charlotte Tilbury', commonWord: true, aliases: ['charlotte tilbury', 'charlottetilbury'], windowDays: 30, clockStart: 'delivery', cat: 'beauty',
    policy: 'Charlotte Tilbury · 30 days from delivery, unused or gently used, for a full refund.',
    gotcha: 'Charlotte Tilbury counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Beaverbrooks', aliases: ['beaverbrooks'], windowDays: 30, clockStart: 'purchase',
    policy: 'Beaverbrooks · 30 days from purchase, unworn with proof of purchase and original packaging; pre-owned watches 14.',
    gotcha: 'Pre-owned watches get 14 days, not 30.',
  },
  {
    name: 'LEGO', commonWord: true, aliases: ['lego'], windowDays: 35, clockStart: 'delivery',
    policy: 'LEGO · 35 days from delivery to return an order free of charge.',
    gotcha: 'LEGO counts the 35 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Muji', aliases: ['muji'], windowDays: 30, clockStart: 'delivery',
    policy: 'Muji · register a return within 30 days from delivery.',
    gotcha: 'Muji counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Foot Locker', aliases: ['foot locker', 'footlocker'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'Foot Locker · 28 days from delivery, unused and complete.',
    gotcha: 'Foot Locker counts the 28 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Ellis Brigham', aliases: ['ellis brigham', 'ellis-brigham'], windowDays: 30, clockStart: 'delivery', cat: 'clothing',
    policy: 'Ellis Brigham · 30 days from delivery, new and unused.',
    gotcha: 'Ellis Brigham counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Blacks', commonWord: true, aliases: ['blacks'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Blacks · 28 days: from purchase in store, from delivery (or collection) online. Refurbished items bought online get 14.',
    gotcha: 'Refurbished items bought online get 14 days from delivery, not 28. An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Millets', commonWord: true, aliases: ['millets'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Millets · 28 days: from purchase in store, from delivery (or collection) online. Refurbished items bought online get 14.',
    gotcha: 'Refurbished items bought online get 14 days from delivery, not 28. An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Trespass', commonWord: true, aliases: ['trespass'], windowDays: 21, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Trespass · 21 days with tags attached: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 21 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Regatta', commonWord: true, aliases: ['regatta'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Regatta · 30 days, unworn: from purchase in store, from delivery online.',
    gotcha: 'An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Mamas & Papas', aliases: ['mamas & papas', 'mamas and papas', 'mamasandpapas'], windowDays: 30, clockStart: 'purchase',
    policy: 'Mamas & Papas · a 30-day returns policy.',
  },
  {
    name: 'JD Williams', aliases: ['jd williams', 'jdwilliams'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'JD Williams · 28 days from delivery, back to their warehouse.',
    gotcha: 'JD Williams counts the 28 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Jacamo', aliases: ['jacamo'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'Jacamo · 28 days from delivery, back to their warehouse.',
    gotcha: 'Jacamo counts the 28 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Topps Tiles', aliases: ['topps tiles', 'toppstiles'], windowDays: 30, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'furniture',
    policy: 'Topps Tiles · 30 days unused in original packaging: from purchase in store, from delivery online. Powdered adhesive and levelling compound 7.',
    gotcha: 'Powdered adhesive and levelling compound get 7 days, not 30. An online order counts the 30 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Selco', aliases: ['selco'], windowDays: 28, clockStart: 'purchase', cat: 'furniture',
    policy: 'Selco · 28 days with your invoice, some items excluded.',
  },
  {
    name: 'Poundstretcher', aliases: ['poundstretcher'], windowDays: 28, clockStart: 'purchase',
    policy: 'Poundstretcher · 28 days in original condition with proof of purchase.',
  },
  {
    name: 'Levi\'s', commonWord: true, aliases: ['levi\'s', 'levi’s', 'levis'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'Levi’s · 28 days from purchase.',
  },
  {
    name: 'Jack & Jones', commonWord: true, aliases: ['jack & jones', 'jack and jones', 'jackjones'], windowDays: 100, clockStart: 'delivery', cat: 'clothing',
    policy: 'Jack & Jones · 100 days from delivery for an online order.',
    gotcha: 'Jack & Jones counts the 100 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Bershka', aliases: ['bershka'], windowDays: 30, clockStart: 'dispatch', cat: 'clothing',
    policy: 'Bershka · 30 days from dispatch (the shipping confirmation email).',
    gotcha: 'Bershka counts from the shipping confirmation, not the day it arrives — the window is already running when it lands. After the 30 days a return is refunded as a voucher.',
  },
  {
    name: 'Massimo Dutti', aliases: ['massimo dutti', 'massimodutti'], windowDays: 30, clockStart: 'dispatch', cat: 'clothing',
    policy: 'Massimo Dutti · 30 days from dispatch to request a return of an online order.',
    gotcha: 'Massimo Dutti counts from the day the order ships, not the day it arrives — the window is already running when it lands.',
  },
  {
    name: 'Accessorize', commonWord: true, aliases: ['accessorize'], windowDays: 30, clockStart: 'purchase', cat: 'clothing',
    policy: 'Accessorize · 30 days in original condition (sale items 14).',
    gotcha: 'Sale items get 14 days, not 30.',
  },
  {
    name: 'Ann Summers', aliases: ['ann summers', 'annsummers'], windowDays: 28, clockStart: 'purchase', cat: 'clothing',
    policy: 'Ann Summers · 28 days from purchase, unworn with tags and hygiene seals intact.',
  },
  {
    name: 'Microsoft Store', aliases: ['microsoft store'], windowDays: 60, clockStart: 'delivery',
    policy: 'Microsoft Store · 60 days from delivery for physical Microsoft products.',
    gotcha: 'Microsoft Store counts the 60 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Appliances Direct', aliases: ['appliances direct', 'appliancesdirect'], windowDays: 30, clockStart: 'delivery', cat: 'kitchen',
    policy: 'Appliances Direct · 30 days from delivery to arrange a return.',
    gotcha: 'Appliances Direct counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Bose', commonWord: true, aliases: ['bose'], windowDays: 30, clockStart: 'delivery', cat: 'audio',
    policy: 'Bose · 30 days from delivery for a return request.',
    gotcha: 'Bose counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Joe Browns', aliases: ['joe browns', 'joebrowns'], windowDays: 28, clockStart: 'delivery', cat: 'clothing',
    policy: 'Joe Browns · 28 days from delivery, free.',
    gotcha: 'Joe Browns counts the 28 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Nobody\'s Child', aliases: ['nobody\'s child', 'nobody’s child', 'nobodyschild'], windowDays: 30, clockStart: 'delivery', cat: 'clothing',
    policy: 'Nobody’s Child · 30 days from delivery for full-price items (sale items 14).',
    gotcha: 'Sale and markdown items get 14 days, not 30. Nobody’s Child counts the 30 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Coast', commonWord: true, aliases: ['coast'], windowDays: 21, clockStart: 'delivery', cat: 'clothing',
    policy: 'Coast · 21 days from the day it arrives, for a refund or store credit.',
    gotcha: 'Coast counts the 21 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Karen Millen', aliases: ['karen millen', 'karenmillen'], windowDays: 21, clockStart: 'delivery', cat: 'clothing',
    policy: 'Karen Millen · 21 days from the day it arrives.',
    gotcha: 'Karen Millen counts the 21 days from the day it arrives, not from your order. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
  {
    name: 'Lands\' End', aliases: ['lands\' end', 'lands’ end', 'landsend'], windowDays: 90, clockStart: 'purchase', cat: 'clothing',
    policy: 'Lands’ End · 90 days from purchase with proof of purchase.',
  },
  {
    name: 'Toast', commonWord: true, aliases: ['toast'], windowDays: 28, clockStart: 'purchase', onlineClockStart: 'delivery', cat: 'clothing',
    policy: 'Toast · 28 days for full-price items (sale items 14): from purchase in store, from delivery online.',
    gotcha: 'Sale items get 14 days, not 28; bought in store, they come back as an exchange or a gift card. An online order counts the 28 days from the day it arrives. Put the arrival date on the receipt and kept counts from there; without it the date shown is the earliest it can be.',
  },
] as const;

/** How many retailers the marketing copy may honestly claim. */
/** How many shops the table holds. Not how many have been checked — see
 *  TABLE_CHECKED_ON below, which is the thing that word used to imply. */
export const STORE_COUNT = STORE_POLICIES.length;

/**
 * The day someone last checked all of these against the retailers' own
 * published terms — not the day the file was last edited.
 *
 * `null` until that has actually happened, and the Settings screen says so
 * rather than implying otherwise. It said "20 verified today", which nothing
 * anywhere recorded or could have recorded: this table is maintained by hand
 * and the README's own pre-ship task is to check every entry. Claiming
 * freshness for the data the whole product rests on, on the screen where
 * someone would go to ask about it, is the worst place to be vague.
 *
 * Same shape as the flag the landing page's social proof carried until it was
 * cut, for the same reason: content that is not yet true says so, visibly,
 * until it is.
 */
export const TABLE_CHECKED_ON: string | null = null;

/**
 * How long a check stays worth quoting.
 *
 * Our judgement, not a fact, so no test asserts the number — what is asserted
 * is the property: that there IS an expiry and that it bites. A year is the
 * unit retailers themselves review terms in, and it is long enough that the
 * caveat means something when it appears.
 */
const CHECK_GOOD_FOR_DAYS = 365;

export type TableCheck =
  | { state: 'never' }
  | { state: 'fresh'; on: Date }
  | { state: 'stale'; on: Date };

/**
 * What the Settings row may honestly say about the table.
 *
 * `TABLE_CHECKED_ON` was added because "20 verified today" claimed a freshness
 * nothing recorded. It fixed the claim and stopped one step short: a date, once
 * set, sits there forever. Measured — with the date at 3 September 2026, the
 * row reads "20 shops · checked 3 September 2026" on the 4th and reads exactly
 * the same in 2029, presented as reassurance on the screen where somebody goes
 * to ask how current the data is.
 *
 * That matters here more than it would elsewhere: this table is maintained by
 * hand, and the app has a whole policy feed precisely BECAUSE shops change
 * their windows. A check that is three years old is not a check.
 *
 * A date in the future reads as fresh rather than stale. A device clock behind
 * the day of the check is the ordinary cause, and calling a check that has just
 * happened "old" would be the worse mistake of the two.
 */
export function tableCheck(today: Date, checkedOn: string | null = TABLE_CHECKED_ON): TableCheck {
  if (checkedOn === null) return { state: 'never' };
  const on = fromISODate(checkedOn);
  const age = daysBetween(on, today);
  return age > CHECK_GOOD_FOR_DAYS ? { state: 'stale', on } : { state: 'fresh', on };
}

const BY_ALIAS = new Map<string, StorePolicy>();
for (const s of STORE_POLICIES) for (const a of s.aliases) BY_ALIAS.set(a, s);

/**
 * The sentence a receipt carries about its return window.
 *
 * Derived from the shop AND the window together, because they are one fact
 * stated two ways and they were drifting apart. A receipt keeps its own
 * `windowDays` — the terms it was bought under, which is right — and it also
 * kept the table's sentence whatever happened to that number: editing a Boots
 * receipt from 35 days to 20 left the detail screen showing RETURN BY 9 Sept
 * above a STORE POLICY card reading "Boots · 35 days". Fifteen days apart, on
 * one screen, and the card is the wording someone repeats at a counter — so
 * the number they would act on was the wrong one, in the direction that makes
 * them late.
 *
 * The table's own wording is used only while the window still matches it.
 * Anything else says what the receipt actually holds and admits it is not
 * verified. One function, so the add screen and the edit screen cannot phrase
 * the same situation differently — which they already did.
 */
/**
 * The sentence a receipt carries, matching the window it was actually given.
 *
 * Three provenances now, and the third arrived the day the Add screen started
 * taking its window from the policy feed. Before that a window differing from
 * the table could only have been typed by the person, so one fallback covered
 * it: "as entered, not verified". Said of a number the app took from its own
 * policy watch, that is simply untrue — it tells someone to go and check a
 * receipt against a figure the app is more confident in than the one it
 * shipped with, and it hides where the number came from on the one screen that
 * explains the deadline.
 */
const FROM_A_POLICY_CHANGE = 'from a policy change on';

export function policyFor(store: string, windowDays: number, changedOn?: string): string {
  const known = findStore(store);
  if (known && known.windowDays === windowDays) return known.policy;
  if (changedOn) {
    return `${store} · ${windowDays}-day return window, ${FROM_A_POLICY_CHANGE} ${fmtDateLong(fromISODate(changedOn))}.`;
  }
  return `${store} · ${windowDays}-day return window — as entered, not verified. Check the receipt.`;
}

/**
 * Whether a receipt's window is one Kept has checked: the shop is in the
 * table and the window is the table's, or it came from a cited policy change.
 *
 * Everything else is a guess or a number typed in, and the two cannot be told
 * apart once saved — "as entered, not verified" covers both. Most shops a
 * person uses are not in the table, so most windows are this kind, and a
 * reminder that says "Today is the last day" about one is stating a guess as
 * fact in the one place a person acts on without opening the app.
 */
export function windowChecked(r: { store: string; windowDays: number; policy: string }): boolean {
  const known = findStore(r.store);
  if (!known) return false;
  return known.windowDays === r.windowDays || r.policy.includes(FROM_A_POLICY_CHANGE);
}

/**
 * The clock a purchase from this shop runs: the online one for an order
 * placed online, when the shop has one; otherwise the shop's clock. One rule,
 * read by the Add and Edit screens, the saved receipt and the Detail screen.
 */
export function clockFor(policy: Pick<StorePolicy, 'clockStart' | 'onlineClockStart'>, distance: boolean): StorePolicy['clockStart'] {
  return distance ? (policy.onlineClockStart ?? policy.clockStart) : policy.clockStart;
}

/**
 * The shop's own name for whatever someone typed.
 *
 * A receipt's `store` is not only a label: `assess` matches a policy update's
 * `affectsStores` against it exactly, so a receipt saved as "boots" is a
 * receipt every change Boots publishes silently misses — no banner, no flag on
 * the Watch tab — while the same receipt happily carries Boots' verified
 * 35-day policy text, because `findStore` is case-insensitive and the rest of
 * the app was not.
 */
export function canonicalStoreName(typed: string): string {
  return findStore(typed)?.name ?? typed.trim();
}

export function findStore(name: string): StorePolicy | undefined {
  return BY_ALIAS.get(name.trim().toLowerCase());
}

/**
 * Longest alias first, so "john lewis" is not swallowed by a future "john"
 * and "marks and spencer" beats a bare "m&s" appearing later in the same
 * email footer.
 */
export const ALIASES_BY_LENGTH: readonly { alias: string; store: StorePolicy }[] = [...BY_ALIAS.entries()]
  .map(([alias, store]) => ({ alias, store }))
  .sort((a, b) => b.alias.length - a.alias.length);
