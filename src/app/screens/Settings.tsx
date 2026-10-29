import { useEffect, useRef, useState, type ReactNode } from 'react';
import { color, font, radius } from '../../tokens';
import { isNative } from '../../lib/mirror';
import { FEED_ORIGIN, feedRefreshes } from '../../lib/feed-origin';
import { storageNote } from '../../lib/persist';
import { fmtDateLong, fromISODate } from '../../lib/dates';
import { MAX_BACKUP_BYTES, parseBackup, restoredNote, type ImportSummary, type RestoreReport } from '../../lib/backup';
import { backupFilename, saveJsonFile, savedWhere, type SaveOutcome } from '../../lib/save-file';
import { alertsRow, currentNotifyState, notifyState, requestNotifyPermission, type NotifyState } from '../notify';
import type { Receipt } from '../../lib/types';
import { COMPANY, CONTACT_EMAIL, TAGLINE } from '../../lib/brand';
import { LEGAL_DISCLAIMER } from '../../lib/legal';
import { checkedCount, CHECKED_ON, STORE_COUNT, tableCheck } from '../../lib/stores';
import { discardSetAside, setAsideData, urgentDayChoices, type Settings as SettingsShape } from '../../lib/storage';
import { FAMILY_SIZE, MANAGE_SUBSCRIPTIONS_URL, restoreOnlyOffered, type Offer } from '../../lib/pricing';
import { MAX_LETTER_NAME, readLetterName } from '../../lib/sign-off';
import type { PlanId, StoreView } from '../../lib/app-store';
import { countedAgainstQuota, FREE_TIER_LIMIT, meterWords } from '../../lib/quota';
import { Pressable } from '../components/Pressable';
import { ChevronRight, ChevronUpDown } from '../components/Icons';
import { Note, RestorePurchase, UnlockOffer } from '../components/UnlockOffer';
import { SupportDetails } from '../components/SupportDetails';

interface Props {
  settings: SettingsShape;
  receipts: Receipt[];
  /** The landing page's demo, whose receipts are its own and live only in memory. */
  embedded: boolean;
  onExport: () => Promise<SaveOutcome>;
  /** The file as read. The reducer merges it into what is here NOW, not into `receipts` as rendered. */
  onRestore: (backup: ImportSummary) => void;
  /** What the last restore did, as the reducer decided it. */
  restored: RestoreReport | null;
  /** The browser's answer to `keepStorage`: null until it is in, and on iPhone. */
  storageKept: boolean | null;
  onWipe: () => void;
  onClearSamples: () => void;
  /** The web's sheet, or the App Store's purchase: App decides which (lib/pricing.ts `Offer`). */
  onUpgrade: (plan: PlanId) => void;
  onChange: (patch: Partial<SettingsShape>) => void;
  /** What this build sells, if anything. */
  offer: Offer;
  /** The App Store on iPhone: its answers and anything in flight. */
  store: StoreView;
  onRestorePurchase: () => void;
}

const RESTORE_FAILURES = {
  'not-json': 'That file isn’t readable — pick the .json file Quids In exported.',
  'not-a-kept-backup': 'That’s a JSON file, but not a Quids In backup.',
  'nothing-usable': 'That backup’s receipts couldn’t be read — nothing was changed.',
  'too-large': 'That file is too large to be a Quids In backup — nothing was changed.',
} as const;

export function Settings({ settings, receipts, embedded, onExport, onRestore, restored, storageKept, onWipe, onClearSamples, onUpgrade, onChange, offer, store, onRestorePurchase }: Props) {
  // How current the retailer table is, decided in `tableCheck` so that a date
  // set once cannot go on reassuring people years later.
  const check = tableCheck(new Date());
  const perShop = checkedCount(new Date());
  const lastRead = Object.values(CHECKED_ON).sort().at(-1);
  const fileInput = useRef<HTMLInputElement>(null);
  // One note under both buttons, because they are one pair: a backup taken and
  // a backup put back. It said nothing at all after an export, which was
  // survivable while the browser's own download shelf answered for it and is
  // not in an app where there is no shelf — see save-file.ts.
  const [backupNote, setBackupNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  /*
   * Seeded synchronously so the row has something to render, then corrected.
   *
   * The seed cannot be the web answer on native: WKWebView has no
   * `Notification`, so `notifyState()` says 'unsupported' there and the switch
   * would render disabled for the one frame before the real answer lands —
   * and it is a switch, so a person could reach it in that frame. 'default'
   * is the honest seed for a question that has not come back yet.
   */
  const [permission, setPermission] = useState<NotifyState>(() =>
    isNative() ? 'default' : notifyState(),
  );
  useEffect(() => {
    let live = true;
    void currentNotifyState().then((state) => {
      if (live) setPermission(state);
    });
    return () => {
      live = false;
    };
  }, []);
  // Two steps, not an eight-second undo. The undo bar is right for one receipt
  // taken back by mistake; this is everything, and it wants a decision.
  const [confirmingWipe, setConfirmingWipe] = useState(false);

  /*
   * What a launch could not read, kept aside by `load` so the next save could
   * not destroy it. Useless kept aside where nobody knows it exists, so this is
   * where it is said, beside the backup it most resembles — and handed over as
   * a file, which is the one thing a person can take to somebody who can read
   * it. Forgotten once saved: the file is theirs now.
   *
   * Never in the landing page's demo, where the store answers nothing: the
   * copy here is the real app's, and the demo showed it and then, once it was
   * saved, threw it away.
   */
  const [setAside, setSetAside] = useState(() => setAsideData());
  const saveSetAside = async () => {
    if (!setAside) return;
    const outcome = await saveJsonFile(backupFilename('rescue', new Date()), setAside);
    const saved = outcome.to !== 'nowhere';
    setBackupNote({ tone: saved ? 'ok' : 'bad', text: savedWhere(outcome) });
    if (saved) {
      discardSetAside();
      setSetAside(null);
    }
  };

  /**
   * Turning alerts on asks the browser first. A switch that flips to "on"
   * while the browser is refusing to show anything is the same lie the
   * original static row told, one layer down.
   */
  const toggleAlerts = async (want: boolean) => {
    if (!want) {
      onChange({ deadlineAlerts: false });
      return;
    }
    const next = permission === 'granted' ? permission : await requestNotifyPermission();
    setPermission(next);
    onChange({ deadlineAlerts: next === 'granted' });
  };

  // The position, the label and the sentence under it all have to agree with
  // one another — the row read "On" beside a switch sitting off, once — so
  // they are decided in one place, next to the permission states they turn on.
  const alerts = alertsRow({
    permission,
    preference: settings.deadlineAlerts,
    native: isNative(),
  });

  const exportNow = async () => {
    const outcome = await onExport();
    setBackupNote({ tone: outcome.to === 'nowhere' ? 'bad' : 'ok', text: savedWhere(outcome) });
  };

  const restore = async (file: File) => {
    // Asked of the file before it is read, so a huge one is refused without
    // being pulled into memory first. See MAX_BACKUP_BYTES.
    const outcome = file.size > MAX_BACKUP_BYTES ? ({ ok: false, reason: 'too-large' } as const) : parseBackup(await file.text());
    if (!outcome.ok) {
      setBackupNote({ tone: 'bad', text: RESTORE_FAILURES[outcome.reason] });
      return;
    }
    /*
     * Handed over as read, and merged by the reducer. This used to merge here,
     * into `receipts` as they were when the screen last rendered — captured
     * before the `await` above — and dispatch the finished list, so a change
     * that landed while the file was being read was overwritten. The sentence
     * follows from what the reducer reports, below.
     */
    onRestore(outcome.summary);
  };
  // A new report object per restore, so the same file restored twice is said twice.
  useEffect(() => {
    if (restored) setBackupNote({ tone: 'ok', text: restoredNote(restored) });
  }, [restored]);

  /*
   * What Erase says it will do. In the landing page's demo it clears the demo's
   * own receipts and nothing on the device, and the sentence has to say so: it
   * read "This removes all 5 receipts from this device", counting the demo's
   * samples, above a tap that erased the visitor's real library instead.
   */
  const noun = receipts.length === 1 ? 'receipt' : 'receipts';
  // The name letters are signed with goes too, and is said to: it is the one
  // thing stored here that says who the person is.
  const named = !!readLetterName(settings.letterName);
  const andName = named ? ' and your name for letters' : '';
  const eraseSays = embedded
    ? confirmingWipe
      ? `This clears the ${receipts.length} ${noun} in this demo. Nothing stored on this device is touched, and reloading the page starts the demo again.`
      : 'Clears the receipts in this demo. Nothing stored on this device is touched.'
    : confirmingWipe
      ? `This removes all ${receipts.length} ${noun}${andName} from this device. There is no undo — export a backup first if you might want them.`
      : `Removes every receipt stored here${andName}. Your data is yours; taking it back is part of that.`;
  const nothingStored = receipts.length === 0 && !named;

  const free = settings.plan === 'free';
  // The meter has to count what the cap counts, or it reports a wall the app
  // will not actually put up.
  const used = countedAgainstQuota(receipts);
  const usagePct = Math.min(100, (used / FREE_TIER_LIMIT) * 100);

  return (
    <div className="k-fade" style={{ flex: 1, overflow: 'auto', padding: '6px 16px 120px', scrollPaddingBottom: 120 }}>
      <h1 tabIndex={-1} style={{ fontSize: 24, fontWeight: 600, padding: '10px 2px 0', margin: 0 }}>Settings</h1>

      {/*
        * The order is an iPhone settings screen's: what is kept and where it
        * goes first, then what the app does unprompted, then the reference it
        * works from, the person's own details, the plan, and help — and the
        * one thing that cannot be undone last, on its own. Erase everything
        * used to sit mid-page, above the urgency setting and Help, a
        * thumb's slip from a scroll past it.
        */}
      <Group
        marker="privacy"
        head="Privacy and backup"
        headId="set-privacy"
        between={
          <>
            {setAside && (
              <div
                style={{
                  marginTop: 10, padding: '10px 13px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5,
                  background: color.dangerChipBg, color: color.ink,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  An earlier launch found receipts it couldn’t read, and kept them aside rather than lose them.
                </div>
                <Pressable
                  className="k-row-white k-secondary"
                  onClick={() => void saveSetAside()}
                  style={{ marginTop: 8, padding: '10px 14px', minHeight: 44, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.control, fontWeight: 600, fontSize: 13 }}
                >
                  Save them as a file
                </Pressable>
              </div>
            )}
            {backupNote && (
              <div
                role="status"
                style={{
                  marginTop: 10, padding: '10px 13px', borderRadius: 12, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5,
                  background: backupNote.tone === 'ok' ? color.accentSoft : color.dangerChipBg,
                  color: backupNote.tone === 'ok' ? color.ink : color.danger,
                }}
              >
                {backupNote.text}
              </div>
            )}
          </>
        }
        foot={
          <>
            {/* "No server" was the loose word: this app is served from one, and
                downloads the policy feed from it every launch — which the Watch
                tab says two taps away. "Nothing uploaded" is both accurate and
                the stronger claim, and it is the wording the onboarding already
                uses. */}
            <p>
              <span style={{ fontWeight: 600, color: color.ink }}>Private by design.</span>{' '}
              Everything lives on this device. No account, nothing uploaded, no one reading your purchases.
            </p>
            {!embedded && !isNative() && storageNote(storageKept) && <p>{storageNote(storageKept)}</p>}
            {/* Said where the button is: a backup carries every receipt and its
                dates, and the photos stay on the phone. The listing promises both
                a restore on a new phone and a photo kept with each receipt, and
                nothing said the two do not travel together. */}
            {isNative() && <p>A backup carries every receipt and its dates. Photos of receipts stay on this phone.</p>}
          </>
        }
      >
        {/* Guideline 5.1.1 wants the policy reachable inside the app, not only
            from the store listing. A plain link: /privacy/ is built into the
            iOS bundle beside the app, so it opens with no network. */}
        <li>
          <a href="/privacy/" className="k-cell k-row-plain">
            <span className="k-cell-label">Privacy policy</span>
            <ChevronRight />
          </a>
        </li>
        <li>
          <Pressable className="k-cell k-row-plain" onClick={() => void exportNow()}>
            <span className="k-cell-action">Export a backup</span>
          </Pressable>
        </li>
        {/* Export without restore is a dead end. With no account, this file is
            the only way anything moves to a new phone. */}
        <li>
          <Pressable className="k-cell k-row-plain" onClick={() => fileInput.current?.click()}>
            <span className="k-cell-action">Restore</span>
          </Pressable>
        </li>
      </Group>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void restore(f);
          // Cleared so picking the same file twice fires change again.
          e.target.value = '';
        }}
      />

      <Group marker="alerts" head="Alerts" headId="set-alerts" foot={<p>{alerts.note}</p>}>
        <li>
          <Toggle
            label="Deadline alerts"
            value={alerts.on}
            detail={alerts.detail}
            disabled={alerts.disabled}
            onChange={(v) => void toggleAlerts(v)}
          />
        </li>
        {/*
          * A menu, not a slider. The slider was a web control on an iPhone
          * screen and offered nineteen positions where four answers cover it.
          * A native <select> opens the phone's own picker. A threshold the
          * slider stored that is not one of the four is still believed on load
          * (`readSettings`), so it is listed in its place (`urgentDayChoices`)
          * rather than shown as a value nobody chose.
          */}
        <li className="k-cell">
          <label htmlFor="urgent" className="k-cell-label">Call it urgent under</label>
          <span className="k-cell-select-wrap">
            <select
              id="urgent"
              className="k-cell-select"
              value={settings.urgentDays}
              onChange={(e) => onChange({ urgentDays: Number(e.target.value) })}
            >
              {urgentDayChoices(settings.urgentDays).map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
            <ChevronUpDown />
          </span>
        </li>
      </Group>

      <Group
        marker="policies"
        head="Policies"
        headId="set-policies"
        foot={
          <>
            {!feedRefreshes(isNative(), FEED_ORIGIN) && (
              <p>The list of policy changes comes with app updates. Quids In downloads nothing.</p>
            )}
            {/* It said "20 verified today", which nothing recorded — the table is
                maintained by hand. Until someone has checked it, the screen says
                that, the way the landing page says its social proof is
                illustrative. And a check goes off: the date alone would have sat
                here reading the same in 2029, which is the same claim decaying
                rather than being false on the day it was written. See
                `tableCheck` in stores.ts. */}
            {/* Until every row is checked, say how many are and which are not —
                not "none", which stopped being true once most of the table had
                been read off the shops' own pages (`CHECKED_ON`). */}
            {check.state === 'never' && (
              <p>
                {perShop.checked} checked against each shop’s own returns page
                {lastRead ? `, most recently ${fmtDateLong(fromISODate(lastRead))}` : ''}.
                {perShop.unchecked.length > 0 && ` Not yet checked: ${perShop.unchecked.join(', ')} — trust your receipt for those.`}
              </p>
            )}
            {check.state === 'stale' && (
              <p>That was over a year ago and shops do change their windows. Always trust your receipt over this.</p>
            )}
          </>
        }
      >
        {/* "Daily · on" was a cadence nothing kept. The feed is fetched once
            per launch — see the effect in App.tsx — which is what this says.

            Except where nothing is fetched at all: the iPhone app until its
            build names a feed host (lib/feed-origin.ts). There a switch would
            be one that turns nothing on and nothing off, and "Every launch"
            a cadence nothing keeps — the defect this row was fixed for twice
            already. So it says where the list comes from instead. */}
        <li>
          {feedRefreshes(isNative(), FEED_ORIGIN) ? (
            <Toggle
              label="Policy watch"
              value={settings.policyWatch}
              detail={settings.policyWatch ? 'Every launch · on' : 'Off'}
              onChange={(v) => onChange({ policyWatch: v })}
            />
          ) : (
            <div className="k-cell">
              <span className="k-cell-label">Policy watch</span>
              <span className="k-cell-value">With app updates</span>
            </div>
          )}
        </li>
        <li className="k-cell">
          <span className="k-cell-label">Retailer policies</span>
          <span className="k-cell-value">
            {STORE_COUNT} shops
            {check.state === 'never' ? '' : ` · checked ${fmtDateLong(check.on)}`}
          </span>
        </li>
      </Group>

      {/* The name the letters are signed with. They ended "[Your name]", with
          a note asking for it to be changed before sending, and a letter
          copied in a hurry went out signed that way. Asked for here and under
          any letter that still has the blank; kept with the settings, on this
          phone (lib/sign-off.ts). The group's heading is the field's label,
          as an iPhone form names a field above it — and only the field's:
          naming the section by it as well gives the label two owners. */}
      <Group
        marker="letters"
        head={<label htmlFor="letter-name">Your name (for letters)</label>}
        footId="letter-name-hint"
        foot={<p>Signs the letters Quids In drafts to shops. It stays on this phone.</p>}
      >
        <li>
          <input
            id="letter-name"
            className="k-cell k-cell-input"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Name"
            maxLength={MAX_LETTER_NAME}
            value={settings.letterName}
            onChange={(e) => onChange({ letterName: e.target.value })}
            aria-describedby="letter-name-hint"
          />
        </li>
      </Group>

      {/* Nothing to buy just now, but a purchase from another iPhone can still come back. */}
      {restoreOnlyOffered(isNative(), offer, store.shelf, free) && (
        <Group
          marker="plan"
          head="Subscribed before?"
          headId="set-restore"
          foot={<p>The App Store isn’t offering it just now, but anything this Apple ID already owns can still be restored.</p>}
        >
          <li style={{ padding: '3px 16px' }}>
            <RestorePurchase store={store} onRestore={onRestorePurchase} />
          </li>
        </Group>
      )}
      {/* No plan, no price and no unlock where nothing can be bought — see offerFor. */}
      {offer.kind !== 'none' && free && (
        <Group
          marker="plan"
          head="Plan"
          headId="set-plan"
          foot={
            <>
              {/* "2 of 10 free receipts", read by someone who had saved three,
                  said ten in a lifetime. The count is of OPEN ones (quota.ts):
                  say so, or the free plan reads smaller than it is. */}
              <p>Ones you have returned or kept do not count, so a return frees a slot.</p>
              <p>Plus has no limit on receipts. Family is Plus for up to {FAMILY_SIZE} people, shared through Apple Family Sharing.</p>
            </>
          }
        >
          <li className="k-cell" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span className="k-cell-label">Free plan</span>
              <span className="k-cell-value" style={{ fontFamily: font.figures, fontSize: 13.5 }}>
                {meterWords(used)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.min(used, FREE_TIER_LIMIT)}
              aria-valuemin={0}
              aria-valuemax={FREE_TIER_LIMIT}
              aria-label="Open receipts on the free plan"
              style={{ height: 6, borderRadius: 999, background: color.surfaceDeep, marginTop: 10, overflow: 'hidden' }}
            >
              <div style={{ height: '100%', background: color.accent, borderRadius: 999, width: `${usagePct}%` }} />
            </div>
          </li>
          {/* The landing page's prices on the web, the App Store's on iPhone — see lib/pricing.ts. */}
          <li style={{ padding: '0 16px 8px' }}>
            <UnlockOffer offer={offer} store={store} onUnlock={onUpgrade} onRestore={onRestorePurchase} buttonStyle={{ marginTop: 12 }} />
          </li>
        </Group>
      )}

      {/* Unlocking used to remove this whole block and put nothing in its
          place, so the app went quiet about a plan the person had just chosen.
          Someone coming back a week later would find no plan section at all,
          and no reason to doubt they were being billed. They are not: say so
          where the price used to be, not only in the sheet they tapped past. */}
      {/* Said whatever the App Store is doing now: on iPhone the plan is 'pro'
          only because StoreKit verified a purchase. And there money WAS taken,
          so the web's sentence would be false. */}
      {!free && (
        <Group
          marker="plan"
          head="Plan"
          headId="set-plan"
          between={isNative() && <div role="status">{store.note && <Note note={store.note} />}</div>}
          foot={
            isNative() ? (
              <p>
                Quids In Plus, through the App Store. It renews until you cancel it, which you can do at any time in{' '}
                <a href={MANAGE_SUBSCRIPTIONS_URL} target="_blank" rel="noreferrer" style={{ color: color.accentInk, fontWeight: 600 }}>
                  your Apple ID’s subscriptions
                </a>
                .
              </p>
            ) : (
              <p>Nothing was charged and no card was taken — Quids In cannot take payments in the browser. There is no subscription here to cancel.</p>
            )
          }
        >
          <li className="k-cell">
            <span className="k-cell-label">Unlocked</span>
            <span className="k-cell-value" style={{ fontFamily: font.figures, fontSize: 13.5 }}>
              {used} receipts · no limit
            </span>
          </li>
        </Group>
      )}

      {/* The samples, on their own: Erase everything was the only way to be
          rid of all of them, and it takes the real receipts too. */}
      {receipts.some((r) => r.demo) && (
        <Group
          marker="samples"
          head="Sample receipts"
          headId="set-samples"
          foot={<p>The receipts marked sample show what Quids In does. Removing them leaves your own receipts exactly as they are.</p>}
        >
          <li>
            <Pressable className="k-cell k-row-plain" onClick={onClearSamples}>
              <span className="k-cell-action">Remove the samples</span>
            </Pressable>
          </li>
        </Group>
      )}

      {/* The version, and what to send when something goes wrong. Shown, not
          just copied: the person reads every line before it leaves. */}
      <Group marker="support" head="Help and support" headId="support-title">
        {/* The one channel back from people using it: kept measures nothing
            about them, by design, so what testers write is the whole of the
            feedback. Shown only once there is an address someone reads, and
            the address is printed, because a mail link does not open
            everywhere. */}
        {CONTACT_EMAIL && (
          <li>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Quids%20In%20feedback`} className="k-cell k-row-plain">
              <span className="k-cell-label">Send feedback</span>
              <span className="k-cell-value" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {CONTACT_EMAIL}
              </span>
              <ChevronRight />
            </a>
          </li>
        )}
        <li style={{ padding: '14px 16px 8px' }}>
          <SupportDetails receipts={receipts} />
        </li>
      </Group>

      <p style={{ fontSize: 11, color: color.muted, textAlign: 'center', margin: '14px 16px 0', lineHeight: 1.6 }}>
        Quids In · {TAGLINE} — get your money back
        <br />
        {/* The seller, by the name App Review sees on the listing. The full
            disclosure is the website's; one line here is enough. */}
        Made by {COMPANY.name}
        <br />
        {LEGAL_DISCLAIMER}
      </p>

      {/* Last, and alone, as an iPhone puts it: the one control here that
          cannot be taken back. Two steps, not an undo — see confirmingWipe. */}
      <Group marker="erase" foot={<p>{eraseSays}</p>}>
        {confirmingWipe ? (
          <li style={{ display: 'flex', gap: 8, padding: 12 }}>
            <Pressable
              className="k-row-white k-secondary"
              onClick={() => setConfirmingWipe(false)}
              style={{ flex: 1, padding: 12, textAlign: 'center', background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.control, fontWeight: 600, fontSize: 13 }}
            >
              Keep them
            </Pressable>
            <Pressable
              onClick={() => {
                setConfirmingWipe(false);
                setBackupNote(null);
                onWipe();
              }}
              style={{ flex: 1, padding: 12, textAlign: 'center', background: color.dangerFill, color: color.white, borderRadius: radius.control, fontWeight: 600, fontSize: 13 }}
            >
              Erase everything
            </Pressable>
          </li>
        ) : (
          <li>
            <Pressable
              className="k-cell k-row-plain"
              onClick={() => setConfirmingWipe(true)}
              disabled={nothingStored}
              style={{
                justifyContent: 'center', fontWeight: 600,
                color: nothingStored ? color.muted : color.danger,
                opacity: nothingStored ? 0.55 : 1,
                cursor: nothingStored ? 'not-allowed' : 'pointer',
              }}
            >
              {nothingStored ? 'Nothing stored' : 'Erase everything'}
            </Pressable>
          </li>
        )}
      </Group>
    </div>
  );
}

/**
 * One group of an iPhone-style settings list: a small heading, the rows in
 * one soft card divided by hairlines (`.k-group`), and the explanation in
 * small type under it. `between` is for what answers a row just pressed —
 * a backup's note, the App Store's — which belongs next to the rows, above
 * the standing explanation.
 */
function Group({ marker, head, headId, foot, footId, between, children }: {
  marker: string;
  head?: ReactNode;
  headId?: string;
  foot?: ReactNode;
  footId?: string;
  between?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-settings-group={marker} aria-labelledby={head ? headId : undefined}>
      {head ? (
        <h2 id={headId} className="k-set-head">
          {head}
        </h2>
      ) : (
        <div aria-hidden="true" style={{ height: 34 }} />
      )}
      <ul className="k-group">{children}</ul>
      {between}
      {foot && (
        <div id={footId} className="k-set-foot">
          {foot}
        </div>
      )}
    </section>
  );
}

/**
 * The design drew these as static rows ending in a chevron. They are the two
 * things the app actually does to you unprompted, so they are switches: a
 * notification setting you can read but not change is a setting in name only.
 */
function Toggle({ label, detail, value, disabled, onChange }: {
  label: string; detail: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      className="k-cell"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      disabled={disabled}
      style={{ opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {/* The name keeps its line; only the status may wrap, beside the switch.
          With the two sharing the row equally, "Blocked by your browser" split
          the label as well — "Deadline / alerts" — on a phone. */}
      <span className="k-cell-label">{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span className="k-cell-value">{detail}</span>
        <span
          aria-hidden="true"
          style={{
            width: 40, height: 24, borderRadius: 999, flexShrink: 0,
            background: value ? color.accent : color.surfaceDeep,
            border: `1px solid ${value ? color.accent : color.borderSoft}`,
            display: 'flex', alignItems: 'center', padding: 2, transition: 'background .2s',
          }}
        >
          <span
            style={{
              width: 16, height: 16, borderRadius: 999, background: color.white,
              boxShadow: '0 1px 2px rgba(42,26,46,0.2)',
              transform: `translateX(${value ? 16 : 0}px)`, transition: 'transform .2s',
            }}
          />
        </span>
      </span>
    </Pressable>
  );
}
