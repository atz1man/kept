import { color } from '../tokens';
import { Fine, ProsePage, Section } from '../pages/Prose';
import { CONTACT_EMAIL } from '../lib/brand';

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


/** Moves whenever what this page says moves. */
export const UPDATED_ON = '29 September 2026';

export function Privacy() {
  return (
    <ProsePage
      title="Privacy"
      lede="Everything lives on this device. No account, nothing uploaded, no one reading your purchases. This page says exactly what that means."
    >
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
          kept uses the camera only when you choose to photograph a receipt. A picture taken to scan a receipt is read
          on this phone — the text is worked out here, not by a server. In the iPhone app it is then kept with the
          receipt as proof of purchase, unless you untick that before saving; in a browser it is discarded. A picture
          kept with a receipt is stored with it, inside the app, and nowhere else, and it is never uploaded.
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

        <Fine>Last updated {UPDATED_ON}.</Fine>
    </ProsePage>
  );
}
