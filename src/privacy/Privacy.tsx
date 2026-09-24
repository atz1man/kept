import type { ReactNode } from 'react';
import { color, font } from '../tokens';

/**
 * The privacy policy.
 *
 * App Store Connect will not accept a submission without a privacy policy URL,
 * and guideline 5.1.1 wants it reachable inside the app as well — so this is
 * its own entry in the build, which puts it in the iOS bundle too and lets the
 * Settings link work with no network.
 *
 * Every sentence below is a claim about code in this repository, and
 * `test/privacy-page.test.ts` holds the ones that name a control to the
 * control: a policy that says "switch it off in Settings" about a switch that
 * has been renamed is telling someone where to look for nothing.
 */

/**
 * Where privacy questions go. Deliberately unset: it has to be an address
 * someone reads, and that is not a thing to guess. While it is null the page
 * says so in plain view rather than printing an address nobody answers.
 */
export const CONTACT_EMAIL: string | null = null;

/** Moves whenever what this page says moves. */
export const UPDATED_ON = '24 September 2026';

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} style={{ marginTop: 34 }}>
      <h2 style={{ fontFamily: font.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>{title}</h2>
      <div style={{ fontSize: 16, lineHeight: 1.65, color: color.body, marginTop: 10 }}>{children}</div>
    </section>
  );
}

export function Privacy() {
  return (
    <main style={{ background: color.cream, color: color.ink, fontFamily: font.ui, minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '44px 20px 80px' }}>
        {/* The way back. In the iOS app there is no browser chrome, and "/" is
            the app itself; on the web it is the home page. */}
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontFamily: font.display, fontWeight: 700, fontSize: 18, color: color.ink, textDecoration: 'none' }}>
          ← kept.
        </a>
        <h1 style={{ fontFamily: font.display, fontSize: 'clamp(32px, 6vw, 44px)', fontWeight: 700, letterSpacing: '-1.4px', lineHeight: 1.05, margin: '28px 0 0' }}>
          Privacy
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: color.bodyStrong, marginTop: 16 }}>
          Everything lives on this device. No account, nothing uploaded, no one reading your purchases. This page says
          exactly what that means.
        </p>

        <Section title="What kept collects">
          Nothing. There is no account, no sign-in and no server that receives your receipts. kept has no analytics,
          no advertising and no crash-reporting service, and it shares nothing with anyone, because it holds nothing
          about you to share.
        </Section>

        <Section title="What stays on your device">
          Your receipts — the shop, the item, the amount and the dates — any photographs of receipts you take, your
          settings, and a note of which reminders have already been shown. On iPhone a second copy is kept in the app’s
          own Documents folder, so a damaged store can be recovered. Deleting the app deletes everything inside it.
        </Section>

        <Section title="The one thing kept downloads">
          kept may download an updated list of retailer return policies, so that a shop changing its window can be
          shown to you. That download is the same for everyone: it asks for every change, never for the shops you use,
          and it carries nothing about you or your receipts. You can turn it off in Settings with the Policy watch
          switch.
        </Section>

        <Section title="Reminders">
          Deadline reminders are notifications your phone schedules for itself. No push service is involved and
          nothing leaves the device to make them happen. You can turn them off in Settings with the Deadline alerts
          switch, or in your phone’s own settings.
        </Section>

        <Section title="Camera and photos">
          kept uses the camera only when you choose to photograph a receipt. The picture is stored with that receipt,
          inside the app, and nowhere else.
        </Section>

        <Section title="Backups">
          When you export a backup, kept writes a file and hands it to you. Where it goes next is your choice, and kept
          keeps no record of where it went.
        </Section>

        <Section title="Your rights">
          Because kept holds nothing about you, there is nothing for anyone to access, correct, export or delete on
          your behalf — all of it is on your phone, where you can export it, and Erase everything in Settings removes
          it from the app.
        </Section>

        <Section title="Changes">
          If this ever changes — if kept ever sends anything anywhere — this page will say so before the app does.
        </Section>

        <Section id="contact" title="Contact">
          {CONTACT_EMAIL ? (
            <>
              Questions about privacy, or about anything else in kept:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: color.ink, fontWeight: 600 }}>{CONTACT_EMAIL}</a>.
            </>
          ) : (
            <span style={{ color: color.danger, fontWeight: 600 }}>
              No contact address has been set yet. One is required before this page is published.
            </span>
          )}
        </Section>

        <p style={{ fontSize: 13, color: color.muted, marginTop: 44 }}>Last updated {UPDATED_ON}.</p>
      </div>
    </main>
  );
}
