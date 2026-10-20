import { useState } from 'react';
import { color, font, radius } from '../../tokens';
import { applyDraft, countsFromDispatch, draftFrom, effectiveWindowStart, validateDraft, type DraftErrors, type ReceiptDraft } from '../../lib/draft';
import { addDays, addMonths, fmtDateLong, fmtDateNear, fromISODate, toISODate } from '../../lib/dates';
import { STORE_POLICIES } from '../../lib/stores';
import type { Category, Receipt } from '../../lib/types';
import { CatIcon } from '../components/Icons';
import { Field, PREFIXED_PAD, Prefixed, inputStyle } from '../components/Field';
import { HowBought } from '../components/HowBought';
import { Pressable } from '../components/Pressable';

const CATEGORIES: { cat: Category; label: string }[] = [
  { cat: 'audio', label: 'Tech' },
  { cat: 'kitchen', label: 'Kitchen' },
  { cat: 'clothing', label: 'Clothing' },
  { cat: 'beauty', label: 'Beauty' },
  { cat: 'furniture', label: 'Home' },
  { cat: 'other', label: 'Other' },
];

interface Props {
  receipt: Receipt;
  today: Date;
  onSave: (r: Receipt) => void;
  onCancel: () => void;
}

export function Edit({ receipt, today, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ReceiptDraft>(() => draftFrom(receipt));
  const [errors, setErrors] = useState<DraftErrors>({});

  const set = <K extends keyof ReceiptDraft>(key: K, value: ReceiptDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // Clear this field's complaint as soon as it is being addressed; leaving it
    // shouting while someone fixes it is just noise.
    setErrors((e) => (key in e ? { ...e, [key]: undefined } : e));
  };

  const save = () => {
    const out = validateDraft(draft, today);
    if (!out.ok) {
      setErrors(out.errors);
      return;
    }
    onSave(applyDraft(receipt, out.value));
  };

  // Live preview of the consequence, because the window and the purchase date
  // are abstractions and the deadline is the thing the person actually cares
  // about.
  const windowDays = Number(draft.windowDaysText);
  const previewable = /^\d{4}-\d{2}-\d{2}$/.test(draft.purchasedOn) && Number.isInteger(windowDays) && windowDays > 0;
  // Counted from where the window will actually start once saved — which is
  // the dispatch date, on a shop that uses one. Previewing from the purchase
  // date showed a deadline two days adrift from the receipt's own.
  const windowStart = effectiveWindowStart(receipt, draft);
  const deadline = previewable ? fmtDateNear(addDays(fromISODate(windowStart), windowDays), today) : null;

  const warrantyMonths = Number(draft.warrantyMonthsText.trim());
  const warrantyEnds =
    /^\d{4}-\d{2}-\d{2}$/.test(draft.purchasedOn) && Number.isInteger(warrantyMonths) && warrantyMonths > 0
      ? fmtDateLong(addMonths(fromISODate(draft.purchasedOn), warrantyMonths))
      : null;

  return (
    <div className="k-fade" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/*
       * Drawn as an iPhone form sheet's bar, because that is what this screen
       * is: a set of changes that are either kept or thrown away. It was a
       * pushed page, with "‹ Cancel" at the top and Save at the very bottom —
       * and on iOS a back chevron says "go back", not "discard", while the
       * one control that keeps the work sat below the fold of a long form.
       *
       * So: Cancel as plain text on the left, the title in the middle, Save in
       * bold accent on the right, the way Contacts and Calendar draw it. The
       * bar sits above the scroller rather than floating in it, so Save is
       * reachable from every field without scrolling to find it, and nothing
       * in the form ever slides under the bar, where a tap meant for a field
       * would land on the bar (scripts/layout.mjs measures exactly that).
       * That is also why there is no second Save at the foot of the form: two buttons doing one thing,
       * under two names, is a question the person should not have to ask.
       * The grid's equal outer columns keep the title centred whatever the
       * two buttons measure.
       */}
      <div
        data-form-bar
        style={{
          flexShrink: 0,
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: 8,
          minHeight: 52, padding: '4px 8px',
          background: color.canvas,
          borderBottom: `1px solid ${color.borderHair}`,
        }}
      >
        <Pressable
          onClick={onCancel}
          style={{
            justifySelf: 'start', width: 'auto', minHeight: 44, padding: '0 8px',
            background: 'transparent', borderRadius: radius.control, color: color.accentInk,
            fontSize: 17, fontWeight: 400,
          }}
        >
          Cancel
        </Pressable>
        <h1 tabIndex={-1} style={{ fontSize: 17, fontWeight: 600, margin: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>Edit receipt</h1>
        <Pressable
          onClick={save}
          style={{
            justifySelf: 'end', width: 'auto', minHeight: 44, padding: '0 8px',
            background: 'transparent', borderRadius: radius.control, color: color.accentInk,
            fontSize: 17, fontWeight: 700,
          }}
        >
          Save
        </Pressable>
      </div>

      <div data-scroller style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 16px 120px', scrollPaddingBottom: 120 }}>
      <p style={{ fontSize: 13, color: color.muted, padding: '0 2px 6px', margin: '14px 0 0' }}>
        Fix anything the paste got wrong — or give it a name you will recognise later.
      </p>

      <div style={{ background: color.surfaceAlt, borderRadius: radius.cardLg, padding: '4px 18px 20px', marginTop: 12 }}>
        <Field id="e-store" label="Shop" error={errors.store} hint="A shop we know brings its policy and window with it.">
          {(p) => (
            <>
              <input
                {...p}
                list="known-stores"
                value={draft.store}
                onChange={(e) => set('store', e.target.value)}
                style={inputStyle(p['aria-invalid'])}
              />
              <datalist id="known-stores">
                {STORE_POLICIES.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <Field id="e-item" label="What is it?" error={errors.item}>
          {(p) => (
            <input
              {...p}
              value={draft.item}
              placeholder="e.g. Running shoes"
              onChange={(e) => set('item', e.target.value)}
              style={inputStyle(p['aria-invalid'])}
            />
          )}
        </Field>

        <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: color.bodyStrong, padding: 0, marginBottom: 6 }}>
            Category
          </legend>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(({ cat, label }) => {
              const on = draft.cat === cat;
              return (
                <Pressable
                  key={cat}
                  onClick={() => set('cat', cat)}
                  aria-pressed={on}
                  style={{
                    width: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                    borderRadius: radius.control, border: `1.5px solid ${on ? color.accent : color.border}`,
                    background: on ? color.accentSoft : color.surface, fontSize: 12.5, fontWeight: 600,
                  }}
                >
                  <CatIcon cat={cat} />
                  {label}
                </Pressable>
              );
            })}
          </div>
        </fieldset>

        <Field id="e-amount" label="Amount" error={errors.amountText}>
          {(p) => (
            <Prefixed prefix="£">
              <input
                {...p}
                inputMode="decimal"
                value={draft.amountText}
                placeholder="e.g. 24.99"
                onChange={(e) => set('amountText', e.target.value)}
                style={{ ...inputStyle(p['aria-invalid']), fontFamily: font.figures, paddingLeft: PREFIXED_PAD }}
              />
            </Prefixed>
          )}
        </Field>

        <Field id="e-bought" label="Bought on" error={errors.purchasedOn}>
          {(p) => (
            <input
              {...p}
              type="date"
              value={draft.purchasedOn}
              max={toISODate(today)}
              onChange={(e) => set('purchasedOn', e.target.value)}
              style={{ ...inputStyle(p['aria-invalid']), fontFamily: font.figures }}
            />
          )}
        </Field>

        {/* Correctable here as well as at the point of adding, because a
            receipt saved from a pasted email defaults to a distance purchase
            and someone who pasted a shop receipt has to be able to say so. */}
        <HowBought id="e-how" value={draft.distance} onChange={(v) => set('distance', v)} />

        {/* Only for a delivered order. A counter purchase arrives when it is
            bought, and both statutory clocks start when the goods reach you —
            so without this the app can only say "at least until". */}
        {draft.distance && (
          <Field
            id="e-arrived"
            label="Arrived on"
            error={errors.arrivedOnText}
            hint={draft.arrivedOnText ? undefined : 'Optional. Leave blank if it has not arrived, or you cannot remember.'}
          >
            {(p) => (
              <input
                {...p}
                type="date"
                value={draft.arrivedOnText}
                max={toISODate(today)}
                onChange={(e) => set('arrivedOnText', e.target.value)}
                style={{ ...inputStyle(p['aria-invalid']), fontFamily: font.figures }}
              />
            )}
          </Field>
        )}

        {/* Only for a shop that starts its own window at the warehouse — one
            of the twenty does. The detail screen otherwise tells the person
            that "this receipt does not say when that was" and offers no way
            to say it, which is an instruction to do something impossible. */}
        {countsFromDispatch(draft.store, draft.distance) && (
          <Field
            id="e-dispatched"
            label="Dispatched on"
            error={errors.dispatchedOnText}
            hint={
              draft.dispatchedOnText
                ? undefined
                : `${draft.store.trim() || 'This shop'} counts its window from dispatch. Without this the deadline is the earliest it can be.`
            }
          >
            {(p) => (
              <input
                {...p}
                type="date"
                value={draft.dispatchedOnText}
                max={toISODate(today)}
                onChange={(e) => set('dispatchedOnText', e.target.value)}
                style={{ ...inputStyle(p['aria-invalid']), fontFamily: font.figures }}
              />
            )}
          </Field>
        )}

        <Field
          id="e-window"
          label="Return window (days)"
          error={errors.windowDaysText}
          hint={deadline ? `Deadline: ${deadline}` : undefined}
        >
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              value={draft.windowDaysText}
              onChange={(e) => set('windowDaysText', e.target.value)}
              style={{ ...inputStyle(p['aria-invalid']), fontFamily: font.figures }}
            />
          )}
        </Field>

        <Field
          id="e-warranty"
          label="Warranty (months)"
          error={errors.warrantyMonthsText}
          hint={warrantyEnds ? `Cover until ${warrantyEnds}` : 'Leave blank if there is none.'}
        >
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              value={draft.warrantyMonthsText}
              placeholder="e.g. 24"
              onChange={(e) => set('warrantyMonthsText', e.target.value)}
              style={{ ...inputStyle(p['aria-invalid']), fontFamily: font.figures }}
            />
          )}
        </Field>

        <Field id="e-order" label="Order number" error={errors.orderRefText} hint="Optional. Returns forms and the letter to the shop ask for it.">
          {(p) => (
            <input
              {...p}
              value={draft.orderRefText}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => set('orderRefText', e.target.value)}
              style={{ ...inputStyle(p['aria-invalid']), fontFamily: font.figures }}
            />
          )}
        </Field>
      </div>

      {/* The date itself is in the field above now, so this says only what the
          field cannot: which of the two dates the deadline is counted from,
          and the one rule about it that is not obvious. */}
      {windowStart !== draft.purchasedOn && (
        <p style={{ fontSize: 12.5, color: color.muted, lineHeight: 1.55, margin: '12px 4px 0' }}>
          The deadline above is counted from the dispatch date, not from the day you ordered. Changing the shop to one
          that counts from the till drops it.
        </p>
      )}
      </div>
    </div>
  );
}
