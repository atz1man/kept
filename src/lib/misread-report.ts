import type { ParsedReceipt } from './parse';
import { money } from './money';

/**
 * An order email the app read wrong, as a message a person can choose to send.
 *
 * `parse.ts` was built against emails written to test it, and Quids In
 * measures nothing about the people using it, so a real misread was invisible:
 * the person corrected the card or gave up, and the reader stayed wrong for
 * the next one. This is the way back — the pasted text and what was read from
 * it, in an email the person sends from their own mail app.
 *
 * It is the one place where something about a purchase can leave the phone,
 * so it is held to the app's own rule from the other side: nothing is sent by
 * the app, the whole message is SHOWN before the mail app opens, the person
 * can edit it there, and the details that identify a person rather than a
 * purchase are taken out first. What cannot be removed reliably (a name in a
 * delivery address) is said plainly on the screen rather than promised away.
 */

/** Longest paste carried in the message: a `mailto:` body is a URL, and mail apps stop reading long ones. */
export const MAX_REPORT_TEXT = 6000;

/**
 * Take out what identifies the person and is of no use in fixing the reader:
 * email addresses, UK postcodes, phone numbers, and the name in a greeting.
 *
 * Order numbers stay — their shape is one of the things the reader gets
 * wrong — so the phone rule must not eat one: it needs a UK prefix, spaces
 * only (an Amazon "026-1234567-1234567" is hyphenated), ten or eleven digits
 * in all, and no "order", "ref" or "tracking" label before it on its line.
 */
export function redactPersonal(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, '[postcode]')
    .replace(/(?:\+44 ?\(?0?\)? ?\d{2,4}|\b0\d{2,4}) ?\d{3,4} ?\d{3,4}\b/g, (m, offset: number, whole: string) => {
      const digits = m.replace(/\D/g, '').replace(/^44/, '0');
      if (digits.length !== 10 && digits.length !== 11) return m;
      // "Order number: 01234567890" is eleven digits and no phone.
      const line = whole.slice(whole.lastIndexOf('\n', offset) + 1, offset);
      return /\b(?:order|ref(?:erence)?|invoice|tracking|parcel|consignment)\b/i.test(line) ? m : '[phone]';
    })
    .replace(/^([ \t]*(?:hi|hello|hey|dear|thanks|thank you),?[ \t]+)(?!there\b|customer\b)[^\s,!.:]{1,30}(?:[ \t]+[^\s,!.:]{1,30})?(?=[ \t]*[,!.:]|[ \t]*$)/gim, '$1[name]');
}

export interface MisreadFacts {
  /** package.json's version. */
  version: string;
  /** What was pasted, shared or read off a photo. */
  text: string;
  /** What the reader made of it. */
  parsed: Pick<ParsedReceipt, 'store' | 'amount' | 'purchasedOn' | 'dateFound' | 'arrivedOn' | 'item' | 'orderRef' | 'windowDays'>;
  /** Where the text came from: a photo's misreads are the camera reader's, not the email reader's. */
  from: 'paste' | 'photo' | 'file';
}

/** The whole message, exactly as it is shown and exactly as it is sent. */
export function misreadReport(f: MisreadFacts): string {
  const p = f.parsed;
  const redacted = redactPersonal(f.text.trim());
  const cut = redacted.length > MAX_REPORT_TEXT;
  return [
    `Quids In ${f.version} read this ${f.from === 'paste' ? 'order email' : f.from === 'photo' ? 'photographed receipt' : 'file'} wrong.`,
    '',
    'What was wrong (please say):',
    '',
    '',
    'What it read:',
    `Shop: ${p.store ?? 'not recognised'}`,
    `Total: ${p.amount === null ? 'none found' : money(p.amount)}`,
    `Bought: ${p.dateFound ? p.purchasedOn : 'no date found'}`,
    `Arrived: ${p.arrivedOn ?? 'not said'}`,
    `Item: ${p.item ?? 'none found'}`,
    `Order number: ${p.orderRef ?? 'none found'}`,
    `Return window: ${p.windowDays} days`,
    '',
    `The text${cut ? ` (the first ${MAX_REPORT_TEXT} characters)` : ''}, with email addresses, phone numbers, postcodes and greeting names removed:`,
    '----',
    cut ? redacted.slice(0, MAX_REPORT_TEXT) : redacted,
    '----',
  ].join('\n');
}

/** A mail link carrying the report. The address is the one Settings prints. */
export function misreadMailto(to: string, report: string): string {
  return `mailto:${to}?subject=${encodeURIComponent('Quids In read this wrong')}&body=${encodeURIComponent(report)}`;
}
