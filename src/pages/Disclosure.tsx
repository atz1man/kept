import { color } from '../tokens';
import { COMPANY, REGISTERED_OFFICE } from '../lib/brand';

/**
 * Who publishes Quids In — the trading disclosure, set once.
 *
 * The Companies (Trading Disclosures) Regulations 2008 ask a company's website
 * for four facts: its registered name, its number, its registered office and
 * where it is registered. Every public page carries this line — the landing
 * footer, and the privacy and rights pages through `ProsePage` — and every
 * fact in it comes from `COMPANY`, so the number cannot be retyped wrong on
 * one page and right on another.
 *
 * Small print in the page's own muted ink, which holds 6.1:1 on white.
 */
export function CompanyDisclosure({ align = 'left' }: { align?: 'left' | 'center' }) {
  return (
    <p
      data-company-disclosure
      style={{ fontSize: 13, color: color.muted, lineHeight: 1.6, margin: 0, textAlign: align, overflowWrap: 'anywhere' }}
    >
      Quids In is made by {COMPANY.name}, registered in {COMPANY.jurisdiction}, company no.{' '}
      {COMPANY.number}. Registered office: {REGISTERED_OFFICE}.
    </p>
  );
}
