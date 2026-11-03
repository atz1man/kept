import { useEffect, useState, type ReactNode } from 'react';
import { color, font, radius } from '../../tokens';
import { FREE_TIER_LIMIT } from '../../lib/quota';
import { STORE_COUNT } from '../../lib/stores';
import { LEGAL_DISCLAIMER } from '../../lib/legal';
import { COMPANY, CONTACT_EMAIL } from '../../lib/brand';
import { APP_STORE, IPHONE_ANSWER_ID } from '../app-store-listing';

/*
 * The questions someone asks before trusting a receipt tracker, answered with
 * the numbers the app itself runs on. Every figure here is imported — the free
 * tier, the shop count, the two statutory periods — for the reason the rest of
 * this page does it: a page that sells "knows the real numbers" cannot be the
 * one place they are typed from memory.
 *
 * <details> rather than a scripted accordion: it opens with a keyboard, it is
 * announced as expandable without any ARIA, and it works before the script
 * loads. No price is named here; the pricing section owns it, and
 * scripts/agreement.mjs holds that section to the one in the app.
 */
const FAQ: { q: string; a: ReactNode; id?: string }[] = [
  {
    q: 'Is Quids In free?',
    a: `Yes, for your first ${FREE_TIER_LIMIT} receipts, with every feature included. After that, Quids In Plus unlocks unlimited receipts, by the month or by the year, and Family covers everyone in an Apple Family Sharing group. Both renew until you cancel, which takes a moment in your Apple ID settings.`,
  },
  {
    q: 'Do I need an account? Where are my receipts kept?',
    a: 'No account: nothing to sign up for and no password to forget. Your receipts stay on your phone, and nowhere else. Nothing about your purchases is uploaded: the one thing Quids In downloads is its list of shop policies, and nothing about you goes back the other way. You can export a backup file whenever you like.',
  },
  {
    q: 'Which shops does it know?',
    a: `${STORE_COUNT} of the UK’s big retailers, each with its returns window, the day the clock starts, and the small print. Any other shop works too: you enter the window from the receipt, and Quids In marks it as entered by you rather than checked.`,
  },
  {
    q: 'Will it remind me before a deadline?',
    a: 'Every time you open it, Quids In leads with whatever runs out this week. A web page cannot wake itself, so in a browser it checks when you come back rather than nudging you while closed. The iPhone app we are preparing for the App Store will deliver reminders at 9am, even with the app shut, if you allow it.',
  },
  {
    q: 'Is this legal advice?',
    a: `${LEGAL_DISCLAIMER} Quids In tells you what the law says and drafts a letter for you to send, but it is not a solicitor and does not act for you.`,
  },
  {
    id: IPHONE_ANSWER_ID,
    q: 'How do I put it on my phone?',
    a: <>{APP_STORE.url ? <a href={APP_STORE.url} style={{ color: color.accentInk, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>Get it on the App Store</a> : 'The iPhone app is coming to the App Store'}. Or open Quids In in Safari or Chrome and add it to your Home Screen: it opens like any other app, and works offline.</>,
  },
  {
    q: 'Who makes Quids In?',
    a: CONTACT_EMAIL
      ? <>{COMPANY.name}, a company registered in {COMPANY.jurisdiction}. Write to us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: color.accentInk, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>{CONTACT_EMAIL}</a>.</>
      : `${COMPANY.name}, a company registered in ${COMPANY.jurisdiction}.`,
  },
];

export function Faq() {
  // The App Store button links here; an answer it links to should be open.
  const open = useHashTarget();
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {FAQ.map(({ q, a, id }) => (
        <details key={q} id={id} open={id !== undefined && open === id ? true : undefined} className="k-faq" style={{ background: color.surfaceAlt, borderRadius: radius.card }}>
          <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 22px', minHeight: 44, cursor: 'pointer', fontFamily: font.display, fontWeight: 650, fontSize: 17, letterSpacing: '-0.01em', color: color.ink }}>
            <span>{q}</span>
            <span className="k-faq-mark" aria-hidden="true" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, background: color.surface, display: 'grid', placeItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M6 1v10M1 6h10" fill="none" stroke={color.ink} strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <div style={{ padding: '0 22px 22px', fontSize: 15.5, lineHeight: 1.65, color: color.body, maxWidth: 680 }}>{a}</div>
        </details>
      ))}
    </div>
  );
}

/** The id in the address bar's #fragment, kept current as links on the page change it. */
function useHashTarget(): string {
  const read = () => (typeof location === 'undefined' ? '' : decodeURIComponent(location.hash.slice(1)));
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const on = () => setHash(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}
