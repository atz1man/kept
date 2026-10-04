import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { claimPack, claimPackFilename, claimPackHtml, claimPackText, DEADLINE_WORDS, deadlineState, LETTERS_NOTE, type PackEvent } from '../../lib/claim-pack';
import { daysBetween, fmtDateLong } from '../../lib/dates';
import { readPhoto } from '../../lib/photos';
import { savedWhere, saveTextFile } from '../../lib/save-file';
import type { Receipt } from '../../lib/types';
import { ChevronLeft, Tick } from '../components/Icons';
import { Pressable } from '../components/Pressable';

/**
 * The claim pack, on screen: the same document the file carries, drawn as a
 * timeline so the order of things — which is the whole argument in a dispute —
 * can be read at a glance. See lib/claim-pack.ts for what goes in it and why.
 */
export function ClaimPack({ receipt, today, onBack }: { receipt: Receipt; today: Date; onBack: () => void }) {
  const pack = useMemo(() => claimPack(receipt, today), [receipt, today]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void readPhoto(receipt.id).then((data) => live && setPhoto(data));
    return () => {
      live = false;
    };
  }, [receipt.id]);

  const html = () => claimPackHtml(pack, photo);
  const file = () => new File([html()], claimPackFilename(receipt, today), { type: 'text/html' });
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = async () => {
    const f = file();
    const withFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });
    try {
      await navigator.share({ title: pack.title, text: claimPackText(pack), ...(withFile ? { files: [f] } : {}) });
      setSaid('Shared.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setSaid('That did not work here. Save a copy instead.');
    }
  };
  const save = async () => setSaid(savedWhere(await saveTextFile(claimPackFilename(receipt, today), html(), 'text/html')));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claimPackText(pack));
      setSaid('Copied as text.');
    } catch {
      setSaid('Copying did not work here. Save a copy instead.');
    }
  };

  const recorded = pack.timeline.filter((e) => e.kind === 'happened').length;
  // A floor that has gone by may still be open, so it counts as open here.
  const open = pack.timeline.filter((e) => e.kind === 'deadline' && deadlineState(e) !== 'passed').length;
  // Where "today" falls in the timeline: after everything on or before it.
  const todayAt = pack.timeline.findIndex((e) => daysBetween(today, e.on) > 0);

  const button = { flex: '1 1 auto', width: 'auto', padding: 13, textAlign: 'center', borderRadius: radius.control, fontWeight: 600, fontSize: 14 } as const;

  return (
    <div className="k-fade" style={{ flex: 1, overflow: 'auto', padding: '6px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '4px -2px 10px' }}>
        <Pressable
          onClick={onBack}
          style={{
            display: 'inline-flex', width: 'auto', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 8px 0 2px',
            background: 'transparent', borderRadius: radius.control, color: color.accentInk, fontSize: 15, fontWeight: 500,
          }}
        >
          <ChevronLeft stroke={color.accentInk} />
          Back
        </Pressable>
      </div>

      <div data-pack-hero style={{ background: color.white, borderRadius: radius.hero, padding: 18, border: `1px solid ${color.borderHair}`, boxShadow: shadow.lift }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            aria-hidden="true"
            style={{
              width: 48, height: 48, flexShrink: 0, borderRadius: 14, display: 'grid', placeItems: 'center',
              // A solid ground under the gradient: what the contrast sweep measures,
              // and what paints if the gradient does not. White is 4.8:1 on
              // the lighter end and more on this one.
              backgroundColor: color.accentHover, backgroundImage: `linear-gradient(${color.accentTile}, ${color.accentHover})`, color: color.white,
              fontFamily: font.display, fontSize: 22, fontWeight: 700,
            }}
          >
            {(receipt.store.trim()[0] ?? '?').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: color.accentInk, letterSpacing: 0.3 }}>CLAIM PACK</div>
            <h1 tabIndex={-1} style={{ fontSize: 20, fontWeight: 600, margin: '2px 0 0', overflowWrap: 'anywhere' }}>{receipt.item}</h1>
            <div style={{ fontSize: 14, color: color.muted, marginTop: 2 }}>
              {receipt.store} · <span style={{ fontFamily: font.figures }}>{pack.amount}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 16 }}>
          {[
            [recorded, recorded === 1 ? 'thing on record' : 'things on record'],
            [open, open === 1 ? 'deadline open' : 'deadlines open'],
            [pack.letters.length, pack.letters.length === 1 ? 'letter sent' : 'letters sent'],
          ].map(([n, label]) => (
            <div key={label} style={{ background: color.surfaceAlt, borderRadius: radius.card, padding: '10px 10px 9px' }}>
              <div style={{ fontFamily: font.figures, fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{n}</div>
              <div style={{ fontSize: 12, color: color.muted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: color.body, marginTop: 14 }}>
          Everything about this purchase on one page, in date order — for the shop’s complaints team, your bank, or a
          claim on your card.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {canShare && (
            <Pressable className="k-primary" onClick={() => void share()} style={{ ...button, background: color.accent, color: color.white, border: 0 }}>
              Share the pack
            </Pressable>
          )}
          <Pressable
            className={canShare ? 'k-row-white k-secondary' : 'k-primary'}
            onClick={() => void save()}
            style={canShare ? { ...button, background: color.white, border: `1px solid ${color.borderSoft}` } : { ...button, background: color.accent, color: color.white, border: 0 }}
          >
            Save a copy
          </Pressable>
          <Pressable className="k-row-white k-secondary" onClick={() => void copy()} style={{ ...button, background: color.white, border: `1px solid ${color.borderSoft}` }}>
            Copy as text
          </Pressable>
        </div>
        <div style={{ fontSize: 12.5, color: color.muted, marginTop: 8 }}>
          The copy is a page that opens in any browser; print it to make a PDF.
        </div>
        {said && (
          <div role="status" style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: color.bodyStrong }}>
            {said}
          </div>
        )}
      </div>

      {pack.standing.length > 0 && (
        <Section title="Where it stands">
          {pack.standing.map((s) => (
            <p key={s} style={{ margin: '0 0 6px', fontSize: 14, lineHeight: 1.5, color: color.bodyStrong }}>{s}</p>
          ))}
        </Section>
      )}

      <Section title="Timeline">
        <ol data-pack-timeline style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {pack.timeline.map((e, i) => (
            <li key={`${e.label}-${i}`}>
              {i === todayAt && <TodayMarker today={today} />}
              <Event e={e} last={i === pack.timeline.length - 1} />
            </li>
          ))}
          {todayAt === -1 && (
            <li>
              <TodayMarker today={today} />
            </li>
          )}
        </ol>
      </Section>

      <Section title="The facts">
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '8px 14px', margin: 0, fontSize: 14 }}>
          {pack.facts.map((f) => (
            <div key={f.label} style={{ display: 'contents' }}>
              <dt style={{ color: color.muted }}>{f.label}</dt>
              <dd style={{ margin: 0, color: color.bodyStrong, overflowWrap: 'anywhere', userSelect: 'text' }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Your rights">
        {pack.rights.map((x) => (
          <div key={x.chip} style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, background: x.live ? color.accentSoft : color.surfaceAlt, color: x.live ? color.accentInk : color.muted, padding: '2px 8px', borderRadius: radius.chip }}>
              {x.chip}
            </span>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: color.bodyStrong, marginTop: 5 }}>{x.body}</div>
          </div>
        ))}
      </Section>

      {pack.letters.length > 0 && (
        <Section title="Letters sent">
          <div style={{ fontSize: 12.5, color: color.muted, marginBottom: 8 }}>{LETTERS_NOTE}</div>
          {pack.letters.map((l) => (
            <details key={l.title} style={{ borderTop: `1px solid ${color.borderHair}`, padding: '10px 0' }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, minHeight: 24 }}>
                {l.title} · sent {fmtDateLong(l.sentOn)}
              </summary>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.5, padding: 12, marginTop: 8, background: color.surfaceAlt, borderRadius: 10, color: color.body, userSelect: 'text' }}>
                {l.text}
              </div>
            </details>
          ))}
        </Section>
      )}

      {photo && (
        <Section title="Proof of purchase">
          <img alt="Photo of the receipt" src={`data:image/jpeg;base64,${photo}`} style={{ display: 'block', maxWidth: '100%', borderRadius: 10, border: `1px solid ${color.borderHair}` }} />
        </Section>
      )}

      <Section title="If the shop won’t put it right">
        {pack.escalation.map((s) => (
          <p key={s} style={{ margin: '0 0 6px', fontSize: 14, lineHeight: 1.5, color: color.bodyStrong }}>{s}</p>
        ))}
      </Section>

      <div style={{ fontSize: 12.5, color: color.muted, textAlign: 'center', marginTop: 16 }}>
        Made on {fmtDateLong(today)}. {pack.disclaimer}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: color.surfaceAlt, borderRadius: radius.cardLg, padding: '14px 16px', marginTop: 12 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: color.muted, margin: '0 0 10px' }}>{title}</h2>
      {children}
    </section>
  );
}

/** One line of the timeline: a dot on the rail, the date, what it was. */
function Event({ e, last }: { e: PackEvent; last: boolean }) {
  const state = e.kind === 'happened' ? 'done' : { open: 'open', passed: 'gone', unsure: 'unsure' }[deadlineState(e)];
  const live = state === 'open' || state === 'unsure';
  return (
    <div data-event={state} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', columnGap: 10 }}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!last && <div aria-hidden="true" style={{ position: 'absolute', top: 20, height: 'calc(100% - 20px)', width: 2, background: color.rail, borderRadius: 1 }} />}
        <div
          aria-hidden="true"
          style={{
            position: 'relative', marginTop: 2, width: 18, height: 18, borderRadius: radius.pill, display: 'grid', placeItems: 'center',
            background: state === 'done' ? color.accent : live ? color.white : color.surfaceDeep,
            border: live ? `2px solid ${color.accent}` : `2px solid ${color.white}`,
            boxSizing: 'border-box',
          }}
        >
          {state === 'done' && <Tick size={10} stroke={color.white} width={3} />}
        </div>
      </div>
      <div style={{ paddingBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: color.muted, fontFamily: font.figures }}>
          {e.hedged ? 'At least ' : ''}{fmtDateLong(e.on)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 1 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: state === 'gone' ? color.body : color.ink }}>{e.label}</span>
          {e.kind === 'deadline' && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: radius.chip, background: live ? color.accentSoft : color.surfaceAlt, color: live ? color.accentInk : color.muted }}>
              {DEADLINE_WORDS[deadlineState(e)]}
            </span>
          )}
        </div>
        {e.detail && <div style={{ fontSize: 13, lineHeight: 1.45, color: color.muted, marginTop: 2, overflowWrap: 'anywhere' }}>{e.detail}</div>}
      </div>
    </div>
  );
}

function TodayMarker({ today }: { today: Date }) {
  return (
    <div data-today style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 14px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: color.white, background: color.ink, padding: '2px 8px', borderRadius: radius.chip }}>
        Today · {fmtDateLong(today)}
      </span>
      <span aria-hidden="true" style={{ flex: 1, height: 2, background: color.ink, borderRadius: 1 }} />
    </div>
  );
}
