import { color } from '../tokens';
import {
  COOLING_OFF_DAYS,
  LATER_FAULTS,
  LEGAL_DISCLAIMER,
  PRESUMED_FAULT_RULE,
  REJECT_DAYS,
  RETURN_AFTER_CANCEL_DAYS,
  UNTOLD_EXTENSION,
} from '../lib/legal';
import { STORE_COUNT } from '../lib/stores';
import { Fine, ProsePage, Section } from '../pages/Prose';

/**
 * Your rights when you take something back — the statutory content, published.
 *
 * APN-33: most people know the shop's returns policy and nothing else, and the
 * rights on top of it are the most useful thing kept knows. This is that, as
 * a page someone can find, read and send to a friend, with the app at the end.
 *
 * It says NOTHING about the law that the app does not already say. Every
 * period is the constant the detail screen computes with, and the two
 * sentences worth the most — what is left after the right to reject, and the
 * extension for a trader who never gave the cancellation information — are
 * the app's own strings, imported, not retold. A second telling of a legal
 * rule is a second place for it to be wrong; `test/rights-page.test.ts` holds
 * the page to that.
 */
const Source = ({ href, children }: { href: string; children: string }) => (
  <a href={href} style={{ color: color.ink, fontWeight: 600 }}>{children}</a>
);

export function Rights() {
  return (
    <ProsePage
      title="Your rights when you take something back"
      lede="Most people know the shop’s returns policy and nothing else. UK law gives you rights of your own, on top of it — and they run on their own clocks."
    >
      <Section title={`It’s faulty: ${REJECT_DAYS} days to reject it for a full refund`}>
        <p style={{ margin: 0 }}>
          If something is faulty, not as described, or not fit for the job, the Consumer Rights Act 2015 gives you{' '}
          {REJECT_DAYS} days to reject it for a full refund. It applies wherever you bought it — in a shop or online —
          whatever the shop’s own policy says, and the {REJECT_DAYS} days start when you have the goods, not when you
          paid.
        </p>
        <p style={{ marginBottom: 0 }}>After that, {LATER_FAULTS}</p>
        <p style={{ marginBottom: 0 }}>{PRESUMED_FAULT_RULE}</p>
      </Section>

      <Section title={`Bought online or by phone: ${COOLING_OFF_DAYS} days to change your mind`}>
        <p style={{ margin: 0 }}>
          The Consumer Contracts Regulations 2013 give you {COOLING_OFF_DAYS} days to cancel a purchase made at a
          distance for any reason at all — nothing has to be wrong with it — counted from the day it arrives. Once you
          have told the shop, you have {RETURN_AFTER_CANCEL_DAYS} more days to send it back.
        </p>
        <p style={{ marginBottom: 0 }}>
          It does not apply to things bought in a shop, and some things are excluded: goods made to your
          specification, things that go off quickly, and sealed items you have unsealed for hygiene reasons, among
          others.
        </p>
      </Section>

      <Section title="The shop never told you? It may not have ended">
        {UNTOLD_EXTENSION}
      </Section>

      <Section title="Changed your mind about something from a shop?">
        The law gives no right to return something bought in person just because you have changed your mind. That
        return is the shop’s own promise, with its own window and its own idea of when the clock starts — the day you
        paid, the day it was dispatched, or the day it arrived. That is the part kept has built in for{' '}
        {STORE_COUNT} UK retailers, beside the legal clocks above.
      </Section>

      <Section title="Every clock, on one screen">
        Every receipt in kept shows the shop’s window beside the legal ones that apply to it — one for something bought
        in a shop, two for something bought online — and says which of them closes first. Nothing leaves your
        phone.{' '}
        <a href="/app/" style={{ color: color.ink, fontWeight: 700 }}>Open kept →</a>
      </Section>

      <Fine>
        {LEGAL_DISCLAIMER} This page describes the rights; it cannot say what will happen in your case. The law:{' '}
        <Source href="https://www.legislation.gov.uk/ukpga/2015/15/section/22">Consumer Rights Act 2015, s.22</Source>
        {' · '}
        <Source href="https://www.legislation.gov.uk/uksi/2013/3134/contents">Consumer Contracts Regulations 2013</Source>
        .
      </Fine>
    </ProsePage>
  );
}

