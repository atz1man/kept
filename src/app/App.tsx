import { useEffect, useMemo, useRef, useState } from 'react';
import { color, paperGrain } from '../tokens';
import { dueAlerts, supersededKeys } from '../lib/alerts';
import { FEED_SIG_URL, FEED_URL, mergeFeed, policyAlertFor, readFeed } from '../lib/policy-feed';
import { FEED_PUBLIC_KEY, feedIsAcceptable, verifyFeed } from '../lib/feed-signature';
import { deliver } from './notify';
import { money, sumPence } from '../lib/money';
import { countsAsMoney, recoveredPence } from '../lib/receipts';
import { winSentence } from '../lib/words';
import { exportBackup, wipe } from '../lib/storage';
import { backupFilename, saveJsonFile } from '../lib/save-file';
import { FEATURED_TIER } from '../lib/pricing';
import { SaveFailedBanner } from './components/SaveFailedBanner';
import { TabBar } from './components/TabBar';
import { UndoBar } from './components/UndoBar';
import { UpgradeNotice } from './components/UpgradeNotice';
import { Add } from './screens/Add';
import { Celebrate } from './screens/Celebrate';
import { Detail } from './screens/Detail';
import { Edit } from './screens/Edit';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Settings } from './screens/Settings';
import { Watch } from './screens/Watch';
import { quotaFull, useApp } from './state';

export function App() {
  const { state, dispatch, today, saveFailed } = useApp();
  const { screen, settings } = state;

  const selected = state.receipts.find((r) => r.id === state.selId) ?? null;
  /**
   * A policy change is only news if it lands on a receipt this person holds —
   * decided by the same `assess` the Watch tab reads, so the two screens
   * cannot disagree about whether a change is yours.
   */
  const { line: policyAlert, changed: changedIds } = useMemo(
    () => policyAlertFor(state.updates, state.receipts, today),
    [state.updates, state.receipts, today],
  );

  const recovered = recoveredPence(state.receipts);

  /**
   * Policy updates arrive rather than being frozen into the bundle. Served
   * from this app's own origin, and the download is of EVERY change — never a
   * query naming the shops this person holds, because that query would be the
   * leak the privacy notice rules out.
   */
  useEffect(() => {
    // The switch in Settings actually switches it.
    //
    // It was a stored boolean nothing read: the row said "Policy watch ·
    // Every launch · on", turning it off changed the word to "Off", and the
    // feed downloaded on every launch regardless. On an app whose privacy
    // card promises nothing is uploaded and whose only outbound request this
    // is, a control that claims to stop it and does not is the worst switch
    // to get wrong. The same defect the "Deadline alerts" row had, in the row
    // directly below it.
    if (!settings.policyWatch) return;
    let cancelled = false;
    /*
     * Read as TEXT, not json, because a signature covers BYTES.
     *
     * Parsing first and signing the re-serialised object would let two
     * different documents share one signature wherever JSON.stringify
     * normalised a difference away — key order, whitespace, 1.0 against 1. What
     * is checked here is exactly what arrived.
     */
    void (async () => {
      try {
        const res = await fetch(FEED_URL, { cache: 'no-cache' });
        if (!res.ok) return;
        const body = await res.text();

        /*
         * The signature is only fetched once there is a key to check it with,
         * so the state this ships in makes no extra request at all.
         */
        let verified: boolean | null = null;
        if (FEED_PUBLIC_KEY !== null) {
          const sig = await fetch(FEED_SIG_URL, { cache: 'no-cache' })
            .then((r) => (r.ok ? r.text() : ''))
            .catch(() => '');
          verified = sig.trim() ? await verifyFeed(body, sig.trim(), FEED_PUBLIC_KEY) : null;
        }
        if (!feedIsAcceptable(FEED_PUBLIC_KEY, verified).accept) {
          /*
           * Refused, and the app keeps the feed it already holds. That is the
           * right failure: the held copy was accepted under the same rule, and
           * silently taking an unproven one would defeat the check. Nothing is
           * said on screen because the feed a person can see is unchanged —
           * there is no consequence to report yet.
           */
          return;
        }

        const incoming = readFeed(JSON.parse(body));
        if (cancelled || !incoming || incoming.length === 0) return;
        dispatch({ type: 'feed', updates: mergeFeed(state.updates, incoming) });
      } catch {
        // Offline is the normal case for this app, and the bundled feed is
        // already on screen. A failed refresh is not worth telling anyone
        // about — and unparseable JSON lands here too, which is the same
        // answer: keep what is held.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Once per launch, and again if someone switches the watch back on —
    // which is what a person who has just enabled it expects to happen.
    // Deliberately not depending on `state.updates`: that changes when the
    // fetch lands, and re-running it on every state change would refetch on
    // every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.policyWatch]);

  /**
   * Deadline alerts, computed on open and whenever the app comes back to the
   * foreground. That is the honest ceiling for a web app — see notify.ts — and
   * the Settings screen says so rather than implying a background service.
   */
  const delivering = useRef(false);
  useEffect(() => {
    if (!settings.deadlineAlerts) return;

    const run = async () => {
      // React 18 mounts effects twice in development; without this guard the
      // same alert is delivered twice before either is recorded.
      if (delivering.current) return;
      const alerts = dueAlerts(state.receipts, today, settings.urgentDays, new Set(state.alertsSent));
      if (alerts.length === 0) return;
      delivering.current = true;
      try {
        const shown = await deliver(alerts);
        // Recorded even if the effect has since re-run. What was shown WAS
        // shown; dropping the record because a newer run exists — while the
        // guard above had made that newer run return without delivering —
        // left it unrecorded, and it was shown again at the next foreground.
        // Recording twice is harmless: 'alerted' is a union.
        if (shown.length === 0) return;
        dispatch({ type: 'alerted', keys: shown.flatMap((a) => [a.key, ...supersededKeys(a)]) });
      } finally {
        delivering.current = false;
      }
    };

    void run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.receipts, state.alertsSent, settings.deadlineAlerts, settings.urgentDays, today, dispatch]);
  const onboarding = screen === 'onboard';

  /**
   * Where focus goes when the screen changes.
   *
   * It went to `document.body`. Every screen here is a swap inside one page,
   * so the control that was clicked — a receipt row, Edit, Skip — unmounts as
   * the new screen arrives, and the browser has nowhere to put focus but the
   * document. Measured on four transitions: three lost it outright. What that
   * costs is not theoretical. A keyboard user's next Tab restarts at the top
   * of the document rather than continuing in the screen they just opened, and
   * a screen reader announces nothing at all — the app silently becomes a
   * different app, which is the SPA failure axe cannot see, because nothing
   * about the markup is wrong.
   *
   * The heading is the target rather than the container: it is what the new
   * screen IS, so announcing it says where you have arrived, and it puts the
   * tab order at the top of the new content. `tabIndex={-1}` in each screen
   * makes it focusable without adding a stop to the tab order.
   *
   * Not on first paint — landing on a fresh page with focus already moved is
   * its own kind of disorienting, and there has been no transition to report.
   */
  const firstPaint = useRef(true);
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    const h1 = document.querySelector<HTMLElement>('main h1');
    const heading = h1?.textContent?.trim() ?? '';

    // Focus is RESTORED where it was lost, never taken from a control the
    // person is still on. Tapping a row unmounts the row, so focus falls to
    // the document and has to be put somewhere; tapping a tab-bar button does
    // not, and moving focus off the tab bar there would make the app's primary
    // navigation the hardest thing on the page to reach — it sits after
    // </main>, so getting back to it means tabbing through the whole screen.
    if (document.activeElement === document.body || document.activeElement === null) {
      // preventScroll: the new screen is already at its top, and scrolling to
      // a heading that is already in view is a jump with no cause.
      h1?.focus({ preventScroll: true });
      setAnnounced('');
      return;
    }
    // Focus stayed put, so nothing has said the screen changed. The heading is
    // what the new screen IS, and it is the same words the focus move would
    // have read out — so the two paths tell the person the same thing.
    setAnnounced(heading);
  }, [screen, state.selId]);

  // A backup that leaves the device only if the user says so — it goes to
  // their own file system, not to us. Where that is differs by platform, and
  // on iOS the browser's download does not exist at all: see save-file.ts.
  const exportNow = () =>
    saveJsonFile(backupFilename('backup', new Date()), exportBackup(state));

  /**
   * The sentence the share puts on the clipboard — built here rather than
   * inside the handler, because the Celebrate screen has to be able to show it
   * when the copy fails.
   */
  // Which half of it is earned is decided in `winSentence` — it is a claim
  // about the product, made to somebody else, and this file cannot be rendered.
  const winLine = state.celebrating
    ? winSentence({
        amount: money(state.celebrating.amount),
        store: state.celebrating.store,
        warned: state.celebrating.warned,
        inTime: state.celebrating.inTime,
      })
    : '';

  const shareWin = async () => {
    const line = winLine;
    const win = state.celebrating;
    /*
     * The phone's own share sheet first, with the card as a picture: what
     * people send each other is an image, and the card is designed to be one
     * (win-card.ts). Where there is no share sheet, or it refuses, the
     * sentence goes on the clipboard as before. A cancelled sheet is the
     * person changing their mind, not a failure, so it says nothing.
     */
    if (typeof navigator.share === 'function' && win) {
      try {
        const { renderWinCard } = await import('./win-card');
        const png = await renderWinCard({
          amount: money(win.amount),
          store: win.store,
          inTime: win.inTime,
          recovered: money(recovered),
        }).catch(() => null);
        const file = png ? new File([png], 'kept-money-back.png', { type: 'image/png' }) : null;
        const withPicture = file && navigator.canShare?.({ files: [file] });
        await navigator.share(withPicture ? { files: [file], text: line } : { text: line });
        dispatch({ type: 'shared', outcome: 'shared' });
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        // Refused for another reason: the clipboard is still there.
      }
    }
    /*
     * Say which of the two things happened.
     *
     * It confirmed either way, on the reasoning that a control which appears
     * dead is worse than one that lies. Half right, and the same half this
     * codebase already got wrong once: `save` swallowed a failed write for the
     * same reason, and the fix was to say so rather than to stay quiet.
     *
     * `writeText` fails on an insecure origin — which is every deployment of
     * this over plain HTTP — and wherever the permission is refused. "Copied,
     * paste it anywhere" is then simply untrue, and the person finds out by
     * pasting nothing into a message to a friend.
     */
    let copied = false;
    try {
      await navigator.clipboard.writeText(line);
      copied = true;
    } catch {
      // Nowhere to report it but the screen, which is what the caller does.
    }
    dispatch({ type: 'shared', outcome: copied ? 'copied' : 'failed' });
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...paperGrain,
        // Room for the status bar on a phone, plus the design's own top inset.
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        boxSizing: 'border-box',
        color: color.ink,
        overflow: 'hidden',
      }}
    >
      {/* One main landmark. Without it every screen's content sits outside any
          region, which is what a screen reader's landmark navigation moves
          between. */}
      {/* Above the screen rather than over it: this is not a transient toast,
          it is a standing condition, and it must be visible wherever the person
          happens to be when it starts. */}
      {saveFailed && !onboarding && <SaveFailedBanner onExport={exportNow} />}

      {/* Announces a screen change that did not move focus — see the effect
          above. Rendered always so the region exists before it has anything to
          say: a live region added to the page at the same moment as its text
          is not reliably announced. */}
      <div className="k-sr" role="status" aria-live="polite">{announced}</div>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {onboarding && (
        <Onboarding
          step={state.obStep}
          onNext={() => dispatch({ type: 'ob-next' })}
          onSkip={() => dispatch({ type: 'ob-skip' })}
        />
      )}

      {screen === 'home' && (
        <Home
          receipts={state.receipts}
          today={today}
          urgentDays={settings.urgentDays}
          policyAlert={policyAlert}
          changedIds={changedIds}
          onOpen={(id) => dispatch({ type: 'open', id })}
          onReturn={(id) => dispatch({ type: 'return', id })}
          onAdd={() => dispatch({ type: 'go', screen: 'add' })}
          onWatch={() => dispatch({ type: 'go', screen: 'watch' })}
        />
      )}

      {screen === 'watch' && <Watch updates={state.updates} receipts={state.receipts} today={today} watching={settings.policyWatch} />}

      {screen === 'detail' && selected && (
        <Detail
          receipt={selected}
          today={today}
          urgentDays={settings.urgentDays}
          onBack={() => dispatch({ type: 'go', screen: 'home' })}
          onEdit={() => dispatch({ type: 'go', screen: 'edit' })}
          onReturn={() => dispatch({ type: 'return', id: selected.id })}
          onUnreturn={() => dispatch({ type: 'unreturn', id: selected.id })}
          onKeep={() => dispatch({ type: 'keep', id: selected.id })}
          onUnkeep={() => dispatch({ type: 'unkeep', id: selected.id })}
          onDelete={() => dispatch({ type: 'delete', id: selected.id })}
        />
      )}

      {screen === 'edit' && selected && (
        <Edit
          receipt={selected}
          today={today}
          onSave={(receipt) => dispatch({ type: 'update', receipt })}
          onCancel={() => dispatch({ type: 'go', screen: 'detail' })}
        />
      )}

      {screen === 'add' && (
        <Add
          today={today}
          sharedText={state.sharedText ?? undefined}
          quotaFull={quotaFull(state)}
          trackedTotal={money(sumPence(state.receipts.filter(countsAsMoney(state.receipts)).map((r) => r.amount)))}
          updates={state.updates}
          onSave={(receipt) => dispatch({ type: 'add', receipt })}
          onUpgrade={() => dispatch({ type: 'upgrade-ask', period: FEATURED_TIER.period })}
        />
      )}

      {screen === 'settings' && (
        <Settings
          settings={settings}
          receipts={state.receipts}
          onExport={exportNow}
          onRestore={(receipts) => dispatch({ type: 'restore', receipts })}
          onWipe={() => {
            // Cleared from disk as well as from state: leaving the old blob
            // behind would mean "erase everything" removed it from the screen
            // and nowhere else.
            wipe();
            dispatch({ type: 'wipe' });
          }}
          onUpgrade={(period) => dispatch({ type: 'upgrade-ask', period })}
          onChange={(patch) => dispatch({ type: 'settings', patch })}
        />
      )}

      {screen === 'celebrate' && state.celebrating && (
        <Celebrate
          amount={state.celebrating.amount}
          store={state.celebrating.store}
          inTime={state.celebrating.inTime}
          recovered={recovered}
          shared={state.shared}
          line={winLine}
          onShare={shareWin}
          onDone={() => dispatch({ type: 'go', screen: 'home' })}
        />
      )}

      </main>

      {state.justDeleted && (
        <UndoBar
          key={state.justDeleted.id}
          label={`Deleted ${state.justDeleted.item}`}
          onUndo={() => dispatch({ type: 'undo-delete' })}
          onDismiss={() => dispatch({ type: 'dismiss-undo' })}
        />
      )}

      {state.upgrading && (
        <UpgradeNotice
          period={state.upgrading}
          onUnlock={() => dispatch({ type: 'settings', patch: { plan: 'pro' } })}
          onCancel={() => dispatch({ type: 'upgrade-cancel' })}
        />
      )}

      {!onboarding && (
        <TabBar
          screen={screen}
          alert={changedIds.size > 0}
          onGo={(s) => dispatch({ type: 'go', screen: s })}
        />
      )}
    </div>
  );
}
