import { useEffect, useRef, useState } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { addDays, fmtDate, fmtDateLong, fmtDateNear, fromISODate, toISODate } from '../../lib/dates';
import { money } from '../../lib/money';
import { parseReceiptText, type ParsedReceipt } from '../../lib/parse';
import { fromScan, scanFailure } from '../../lib/receipt-scan';
import { arrivalProblem, readAmount, windowStartFor } from '../../lib/draft';
import { makeReceiptId } from '../../lib/receipts';
import { findStore, policyFor } from '../../lib/stores';
import { windowInForceFor } from '../../lib/policy-feed';
import { FEATURED_TIER } from '../../lib/pricing';
import { FREE_TIER_LIMIT } from '../../lib/quota';
import { isNative } from '../../lib/mirror';
import { savePhoto, scannedPhotoToKeep } from '../../lib/photos';
import { shareRoute } from '../../lib/share';
import type { PolicyUpdate, Receipt } from '../../lib/types';
import { ArrowRight, CameraGlyph, LogoMark, MailGlyph, ShareGlyph, Warning } from '../components/Icons';
import { HowBought } from '../components/HowBought';
import { Pressable } from '../components/Pressable';

interface Props {
  today: Date;
  /**
   * An order email shared in from another app. Arriving with text already in
   * hand, the screen reads it immediately — a share that lands on an empty box
   * and waits to be told to try is not the flow the three-step strip promises.
   */
  sharedText?: string;
  quotaFull: boolean;
  trackedTotal: string;
  /** The policy feed, so a new purchase gets the window in force today. */
  updates: readonly PolicyUpdate[];
  onSave: (r: Receipt) => void;
  onUpgrade: () => void;
}

export function Add({ today, sharedText, quotaFull, trackedTotal, updates, onSave, onUpgrade }: Props) {
  const route = shareRoute(isNative());
  const [text, setText] = useState(sharedText ?? '');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [error, setError] = useState(false);
  // The parser can read a shop and a total, but nothing in an order email
  // reliably says what the thing WAS. Asking here is why the list stops
  // filling up with rows called "From pasted email".
  const [item, setItem] = useState('');
  /**
   * This screen's input is a pasted order email, so a distance purchase is the
   * likelier answer and is offered first — but it is ASKED rather than assumed.
   * It used to be hardcoded true, which told every receipt anyone added by hand
   * that they had a 14-day right to cancel for any reason. Someone who bought
   * it over a counter has no such right, and finds that out at the counter.
   */
  const [distance, setDistance] = useState(true);
  /**
   * The shop, when the paste did not name one Kept knows.
   *
   * The parser deliberately says nothing rather than guessing — "walking
   * boots" is not a Boots order — so this is where the person supplies what it
   * would have been guessing at. Typing a shop Kept does know adopts its real
   * window and wording, which is the whole product; typing anything else
   * leaves the assumed window it already shows.
   */
  const [storeName, setStoreName] = useState('');
  /**
   * The day it arrived, when the person knows it. Both statutory clocks start
   * there, and without it the receipt can only say "at least until" — so it is
   * worth one optional field, and stays optional: an order that has not landed
   * yet genuinely has no such date.
   */
  const [arrivedOn, setArrivedOn] = useState('');
  /**
   * The total, when the paste did not say it. A card reading "Total: Not
   * found" above a live Save stored a £0.00 receipt — which then understated
   * the returnable total, the alerts and the celebration, with nothing ever
   * asking for the figure.
   */
  const [totalText, setTotalText] = useState('');
  /*
   * A photographed paper receipt, read on this device. `scanning` is the
   * progress while it reads, null otherwise; `scanFailed` says it could not.
   */
  const photoInput = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState<number | null>(null);
  const [scanFailed, setScanFailed] = useState<'offline' | 'unreadable' | null>(null);
  // True during the second read, when the first missed the shop, total or date.
  const [lookingAgain, setLookingAgain] = useState(false);
  /*
   * On a phone, the photo the scan took and the text it read from it, so the
   * picture can be kept with the receipt as proof of purchase — see
   * `scannedPhotoToKeep`. Null on the web, where there is nowhere to keep it.
   */
  const [scanShot, setScanShot] = useState<{ base64: string; text: string } | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(true);
  /*
   * What the camera read, on either platform, so the card can say where its
   * findings came from. It said "Found in your paste" after a scan, of text
   * the person never pasted. Edit the text and it is a paste again.
   */
  const [scannedText, setScannedText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Read once, on arrival. A later keystroke must not re-trigger it.
  const [readShare, setReadShare] = useState(false);

  const readText = (source: string) => {
    const outcome = parseReceiptText(source, today);
    if (!outcome.ok) {
      setParsed(null);
      setError(true);
      return;
    }
    setParsed(outcome.value);
    setError(false);
    // Pre-filled when the paste says what it was, and still the person's to
    // change: it names the receipt on every screen after this one.
    setItem(outcome.value.item ?? '');
    setDistance(true);
    setStoreName('');
    setTotalText('');
    // The paste often says "Delivered 27 August" three lines above the total,
    // and this screen was asking the person to read it back out by hand.
    // Still a field they can clear or correct — it is pre-filled, not decided.
    setArrivedOn(outcome.value.arrivedOn ?? '');
  };

  const read = () => readText(text);

  /**
   * Read a photo of a till receipt into the paste box, then read that as a
   * paste. The text goes into the box on purpose: OCR is never perfect, and
   * the person can see and correct what the camera read before anything is
   * saved. A till receipt is a purchase made in person, so it starts as one.
   */
  const scanPhoto = async (file: Blob, base64?: string) => {
    setScanFailed(null);
    setScanning(0);
    setLookingAgain(false);
    setScanShot(null);
    setScannedText(null);
    try {
      const { readReceiptPhoto } = await import('../scan');
      const readable = fromScan(await readReceiptPhoto(file, today, (p, again) => {
        setScanning(p);
        setLookingAgain(again);
      }));
      setText(readable);
      setScannedText(readable);
      readText(readable);
      setDistance(false);
      if (base64) {
        setScanShot({ base64, text: readable });
        setKeepPhoto(true);
      }
    } catch {
      // A reader module that will not even load is a connection problem too.
      const reachable = isNative() || (await import('../scan').then((m) => m.readerReachable()).catch(() => false));
      setScanFailed(scanFailure(reachable, isNative()));
    } finally {
      setScanning(null);
    }
  };

  useEffect(() => {
    if (!sharedText || readShare) return;
    setReadShare(true);
    readText(sharedText);
    // readText is stable enough for this one-shot: the effect is gated on a
    // flag, so a changing identity cannot make it fire twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedText, readShare]);

  /**
   * What the receipt will actually be saved with — the paste's shop, or the
   * one typed in when it found none. Computed once and read by both the save
   * and the deadline preview below, because a preview that disagreed with what
   * lands is a bug this codebase has already had once.
   */
  const typed = storeName.trim();
  const knownFromTyped = parsed?.store ? undefined : typed ? findStore(typed) : undefined;
  const policy = parsed?.policy ?? knownFromTyped ?? null;
  const effectiveStore = parsed?.store ?? policy?.name ?? typed;
  /*
   * The feed first, then the table. A shop's window can have moved since this
   * build shipped, and the Watch tab was already saying so on the screen next
   * door while this one handed out the old number.
   *
   * One binding, read by both the save and the deadline preview below, because
   * a preview that disagreed with what lands is a bug this codebase has had
   * once already.
   */
  const inForce = policy && parsed ? windowInForceFor(policy.name, parsed.purchasedOn, updates) : undefined;
  const effectiveWindow = inForce?.days ?? policy?.windowDays ?? parsed?.windowDays ?? 0;

  /**
   * The same rule the edit screen applies, from the same function. This screen
   * had none: the browser marked the field invalid for a date before the order
   * and the app saved it anyway, which starts both statutory clocks early and
   * reports a live right as expired.
   */
  const arrivalError = parsed && distance && arrivedOn ? arrivalProblem(arrivedOn, parsed.purchasedOn, today) : undefined;

  const typedTotal = parsed && parsed.amount === null && totalText.trim() ? readAmount(totalText) : null;
  const amount = parsed?.amount ?? (typedTotal?.ok ? typedTotal.pence : null);
  const totalError = typedTotal && !typedTotal.ok ? typedTotal.error : undefined;
  const needsTotal = !!parsed && amount === null;
  const cannotSave = quotaFull || !!arrivalError || needsTotal;

  /*
   * Where the clock starts, once, for the save AND the deadline preview. The
   * preview counted from the purchase date while the save stored the arrival
   * (Apple, Amazon, ASOS) or dispatch (Zara) date: an Amazon paste delivered
   * on the 10th previewed 1 October and saved 10 October — a date nine days
   * early on the card, changing the moment it was saved.
   */
  const savedStore = effectiveStore || 'Unknown store';
  const windowStart = parsed
    ? windowStartFor(savedStore, {
        dispatchedOn: parsed.dispatchedOn ?? undefined,
        arrivedOn: distance ? arrivedOn : undefined,
        distance,
      })
    : undefined;

  const photoToKeep = scannedPhotoToKeep(scanShot, text, keepPhoto);

  const save = async () => {
    if (!parsed || quotaFull || arrivalError || amount === null || saving) return;
    const store = savedStore;
    const id = makeReceiptId(today);
    /*
     * The photo is written BEFORE the receipt is added, so the receipt's own
     * screen finds it on the disk the first time it looks (it asks the disk,
     * never a flag; see photos.ts). A photo that could not be written leaves
     * the receipt saved without one, and that screen then offers to take it,
     * which is the truth. A receipt that then fails to save leaves an orphan
     * photo, which `cleanupPhotos` removes.
     */
    if (photoToKeep) {
      setSaving(true);
      await savePhoto(id, photoToKeep);
    }
    onSave({
      id,
      store,
      // A generic fallback, not a dead end: it is editable from the receipt
      // itself the moment this saves.
      item: item.trim() || `${store} purchase`,
      cat: policy?.cat ?? 'other',
      amount,
      purchasedOn: parsed.purchasedOn,
      /*
       * A dispatch-clocked retailer starts counting when the parcel leaves,
       * and until now nothing here could know that date — so every Zara
       * receipt anyone added counted from the order instead. That is the safe
       * direction (dispatch is later, so the order gives the earlier
       * deadline) but it is not the right one: it can say "window closed" on
       * a day the shop would still take the thing back, which is the failure
       * legal.ts calls the one this app must not have.
       *
       * Dispatch confirmations say the date outright, and `pickDispatch` now
       * reads it. Only for a shop whose entry says it counts from dispatch —
       * `clockStart` had been declared on all twenty and read by nothing, and
       * an Argos receipt carrying Zara's clock would be worse than one
       * carrying none.
       */
      ...(windowStart ? { windowStartsOn: windowStart } : {}),
      windowDays: effectiveWindow,
      ...(distance && arrivedOn ? { arrivedOn } : {}),
      policy: policyFor(store, effectiveWindow, inForce?.changedOn),
      distance,
      gotcha: policy?.gotcha,
      status: 'active',
    });
    setSaving(false);
  };

  const deadline = parsed ? fmtDateNear(addDays(fromISODate(windowStart ?? parsed.purchasedOn), effectiveWindow), today) : '';

  return (
    <div className="k-fade" style={{ flex: 1, overflow: 'auto', padding: '6px 16px 120px' }}>
      <h1 tabIndex={-1} style={{ fontSize: 24, fontWeight: 700, padding: '10px 2px 4px', margin: 0 }}>Add a receipt</h1>
      <p style={{ fontSize: 13, color: color.muted, padding: '0 2px 14px', margin: 0 }}>
        Paste an order email — kept reads the store, total and date.
      </p>

      <label htmlFor="paste" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Paste your order email
      </label>
      <textarea
        id="paste"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setParsed(null);
          setError(false);
        }}
        placeholder="Paste your order email here… e.g. 'Your Apple order · Total £129.00 · 25 Aug'"
        style={{
          width: '100%', boxSizing: 'border-box', height: 120, border: '1.5px dashed rgba(23,20,16,0.3)',
          borderRadius: radius.card, background: color.white, padding: 14,
          fontFamily: font.figures, fontSize: 13, color: color.ink, resize: 'none',
        }}
      />

      <Pressable
        className="k-cta-yellow"
        onClick={read}
        style={{ marginTop: 12, padding: 16, textAlign: 'center', background: color.yellow, border: `1.5px solid ${color.ink}`, borderRadius: 999, fontWeight: 700, fontSize: 15, boxShadow: shadow.hard }}
      >
        Read it
      </Pressable>

      {error && (
        <div className="k-fade" role="alert" style={{ display: 'flex', gap: 10, background: color.white, border: '1.5px solid rgba(216,66,46,0.4)', borderRadius: 16, padding: '14px 16px', marginTop: 14 }}>
          <Warning stroke={color.danger} />
          <div style={{ fontSize: 13, color: color.danger, lineHeight: 1.5, fontWeight: 600 }}>
            Couldn’t find a store or amount in that. Make sure the paste includes the shop’s name and a £ total — or add it by scanning the paper receipt.
          </div>
        </div>
      )}

      {quotaFull && (
        <div style={{ background: color.ink, color: color.cream, borderRadius: radius.cardLg, padding: 18, marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>That’s your {FREE_TIER_LIMIT} free receipts</div>
          <div style={{ fontSize: 13, color: color.fainter, lineHeight: 1.55, marginTop: 6 }}>
            Kept has tracked {trackedTotal} for free. Return something you are already tracking, or mark one you are keeping, and a slot frees up —
            or go unlimited, and one missed return pays for the year.
          </div>
          <Pressable
            className="k-cta-yellow"
            onClick={onUpgrade}
            style={{ marginTop: 12, padding: 13, textAlign: 'center', background: color.yellow, color: color.ink, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
          >
            {`Go unlimited · ${FEATURED_TIER.price}${FEATURED_TIER.suffix}`}
          </Pressable>
        </div>
      )}

      {parsed && (
        <div className="k-fade" style={{ background: color.white, border: `1.5px solid ${color.ink}`, borderRadius: radius.cardLg, padding: 18, marginTop: 16, boxShadow: shadow.hard }}>
          <div style={{ fontFamily: font.figures, fontSize: 11, letterSpacing: '1.6px', color: color.amber, fontWeight: 700 }}>
            {scannedText !== null && text === scannedText ? 'READ FROM YOUR PHOTO' : 'FOUND IN YOUR PASTE'}
          </div>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="add-item" style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: color.muted, marginBottom: 6 }}>
              WHAT IS IT?
            </label>
            <input
              id="add-item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Running shoes"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 14,
                border: `1.5px solid ${color.border}`, background: color.white,
                fontFamily: font.ui, fontSize: 14.5, color: color.ink,
              }}
            />
          </div>
          {parsed.store === null && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor="add-store" style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: color.muted, marginBottom: 6 }}>
                WHICH SHOP?
              </label>
              <input
                id="add-store"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Vinted"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 14,
                  border: `1.5px solid ${color.border}`, background: color.white,
                  fontFamily: font.ui, fontSize: 14.5, color: color.ink,
                }}
              />
              {/* The number this line quotes is the number the receipt gets.
                  It quoted the TABLE's window while the "Return window" row a
                  few lines down quoted `effectiveWindow`, which prefers the
                  policy feed — so on a shop whose window the feed has moved,
                  one card stated two different windows about one purchase,
                  and the one read first was the stale one.

                  Where the number came from is part of the fact, which is the
                  rule `policyFor` already applies to the receipt's own
                  sentence: the table's wording while the table's number still
                  holds, and the change named otherwise. "From Kept's list",
                  said of a number the app took from its own policy watch, is
                  simply untrue. */}
              <div style={{ fontSize: 12.5, color: color.muted, marginTop: 5 }}>
                {knownFromTyped
                  ? inForce && effectiveWindow !== knownFromTyped.windowDays
                    ? `${knownFromTyped.name} — ${effectiveWindow} days, from a policy change on ${fmtDateLong(fromISODate(inForce.changedOn))}.`
                    : `${knownFromTyped.name} — ${effectiveWindow} days, from Kept’s list.`
                  : 'We could not find a shop we know in that paste. Name it and we will use its real window if we have it.'}
              </div>
            </div>
          )}
          <HowBought id="add-how" value={distance} onChange={setDistance} />
          {distance && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor="add-arrived" style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: color.muted, marginBottom: 6 }}>
                ARRIVED ON
              </label>
              {/* No `min`. Chromium fills in the invariant parts of a narrow
                  range, so an EMPTY optional field rendered as "08/dd/2026"
                  whenever the purchase was recent — which is most of the time
                  on this screen — and an optional field that looks partly
                  filled reads as one that is set. Measured against the same
                  input with a wide range and with none, which both show
                  mm/dd/yyyy. The rule is enforced below, with a reason, which
                  is better feedback than a picker that silently refuses. */}
              <input
                id="add-arrived"
                type="date"
                value={arrivedOn}
                max={toISODate(today)}
                aria-invalid={!!arrivalError}
                aria-describedby="add-arrived-note"
                onChange={(e) => setArrivedOn(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 14,
                  border: `1.5px solid ${arrivalError ? color.danger : color.border}`, background: color.white,
                  fontFamily: font.figures, fontSize: 14.5, color: color.ink,
                }}
              />
              {arrivalError ? (
                <div id="add-arrived-note" role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: color.danger, marginTop: 5 }}>
                  {arrivalError}
                </div>
              ) : (
                <div id="add-arrived-note" style={{ fontSize: 12.5, color: color.muted, marginTop: 5 }}>
                  Optional. Your legal rights start the day it lands, so this makes those dates exact instead of the
                  earliest they could be.
                </div>
              )}
            </div>
          )}
          <Row label="Store" value={effectiveStore || 'Not recognised'} mono={false} />
          {parsed.amount === null ? (
            <div style={{ margin: '4px 0 10px' }}>
              <label htmlFor="add-total" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
                Total — the email didn’t say
              </label>
              <input
                id="add-total"
                inputMode="decimal"
                value={totalText}
                placeholder="e.g. 24.99"
                aria-invalid={!!totalError}
                aria-describedby={totalError ? 'add-total-note' : undefined}
                onChange={(e) => setTotalText(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 14,
                  border: `1.5px solid ${totalError ? color.danger : color.border}`, background: color.white,
                  fontFamily: font.figures, fontSize: 14.5, color: color.ink,
                }}
              />
              {totalError && (
                <div id="add-total-note" role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: color.danger, marginTop: 5 }}>
                  {totalError}
                </div>
              )}
            </div>
          ) : (
            <Row label="Total" value={money(parsed.amount)} mono />
          )}
          <Row label="Bought" value={`${fmtDate(fromISODate(parsed.purchasedOn))}${parsed.dateFound ? '' : ' (assumed today)'}`} mono />
          <Row label="Return window" value={`${effectiveWindow} days`} mono={false} />
          <Row label="Deadline" value={deadline} mono accent />
          {scanShot && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, minHeight: 44, fontSize: 14, color: photoToKeep || !keepPhoto ? color.ink : color.muted }}>
              <input
                type="checkbox"
                checked={keepPhoto && scanShot.text === text}
                disabled={scanShot.text !== text}
                onChange={(e) => setKeepPhoto(e.target.checked)}
                style={{ width: 22, height: 22, accentColor: color.ink, margin: 0 }}
              />
              {scanShot.text === text
                ? 'Keep the photo as proof of purchase'
                : 'The photo is not kept: this is no longer what it read'}
            </label>
          )}
          {/* The cap is claimed on the pricing page, in Settings and on the
              card above; a Save that quietly ignored it would make all three
              of those decorative. */}
          {/* Greyed for every reason it cannot save, not only the quota: a
              disabled button drawn as a live one invites the tap it ignores. */}
          <Pressable
            className={cannotSave ? undefined : 'k-ink'}
            onClick={() => void save()}
            disabled={cannotSave || saving}
            style={{
              marginTop: 14, padding: 14, textAlign: 'center',
              background: cannotSave ? color.creamAlt : color.ink,
              color: cannotSave ? color.muted : color.cream,
              borderRadius: 999, fontWeight: 700, fontSize: 14,
              cursor: cannotSave ? 'not-allowed' : 'pointer',
            }}
          >
            {quotaFull ? 'Go unlimited to save this' : arrivalError ? 'Fix the arrival date' : needsTotal ? 'Add the total to save' : 'Save receipt'}
          </Pressable>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1.5, background: color.border }} />
        <span style={{ fontSize: 12, color: color.muted }}>or</span>
        <div style={{ flex: 1, height: 1.5, background: color.border }} />
      </div>

      {/* Opens the camera on a phone, the file picker elsewhere. */}
      <input
        ref={photoInput}
        id="add-photo"
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Cleared so choosing the same photo again still fires.
          e.target.value = '';
          if (f) void scanPhoto(f);
        }}
      />
      <Pressable
        className="k-row-white"
        onClick={() => {
          // The camera itself in the iOS app, never the library; a file
          // picker (or the phone's camera) on the web.
          if (!isNative()) {
            photoInput.current?.click();
            return;
          }
          void (async () => {
            try {
              const { takeReceiptPhoto } = await import('../scan');
              const shot = await takeReceiptPhoto();
              if (shot) await scanPhoto(shot.blob, shot.base64);
            } catch {
              setScanFailed('unreadable');
            }
          })();
        }}
        disabled={scanning !== null}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16,
          background: color.white, border: `1.5px solid ${color.ink}`, borderRadius: 999,
          fontWeight: 700, fontSize: 15, cursor: scanning !== null ? 'progress' : 'pointer',
        }}
      >
        <CameraGlyph />
        {scanning === null
          ? 'Scan a paper receipt'
          : `${lookingAgain ? 'Having another look' : 'Reading your receipt'}… ${Math.round(scanning * 100)}%`}
      </Pressable>
      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: scanFailed ? color.danger : color.muted, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
        {scanFailed === 'offline'
          ? 'Scanning in a browser needs a connection, to fetch the reader. Paste or type the details, or scan again when you are back online.'
          : scanFailed
          ? 'kept couldn’t read that photo. Try again flat, straight and in good light — or paste or type the details.'
          : scanning !== null
            ? 'Reading it on this phone. Nothing is uploaded.'
            : 'Read on this phone — the photo is never uploaded. Check what it read before you save.'}
      </div>

      {/* The three steps are a promise about the device holding them, and it
          was made everywhere: Web Share Target is Chromium's, so an iPhone
          following them adds an icon that appears in no share sheet, and the
          iOS app has no share extension to appear in one either. See
          `shareRoute` for why this is copy rather than a feature test. */}
      <div style={{ background: color.creamAlt, border: '1.5px dashed rgba(23,20,16,0.2)', borderRadius: radius.card, padding: '16px 18px', marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', color: color.muted }}>{route.heading}</div>
        <div style={{ fontSize: 12, color: color.muted, lineHeight: 1.5, marginTop: 6 }}>
          {route.body}
        </div>
        {route.steps && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <Step icon={<MailGlyph />} label="Open the order" />
            <ArrowRight stroke={color.fainter} />
            <Step icon={<ShareGlyph />} label="Tap share" />
            <ArrowRight stroke={color.fainter} />
            <Step icon={<LogoMark size={18} />} label="Pick kept — done" dark />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 9 }}>
      <span style={{ color: color.muted, fontSize: 13 }}>{label}</span>
      <span
        style={{
          fontWeight: 700, fontSize: 14, textAlign: 'right',
          fontFamily: mono ? font.figures : undefined,
          color: accent ? color.amber : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Step({ icon, label, dark }: { icon: React.ReactNode; label: string; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
      <div
        style={{
          width: 40, height: 40, borderRadius: 12,
          background: dark ? color.ink : color.white,
          border: dark ? undefined : `1.5px solid ${color.borderSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: color.muted, textAlign: 'center' }}>{label}</span>
    </div>
  );
}
