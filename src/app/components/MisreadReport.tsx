import { lazy, Suspense, useId, useState } from 'react';
import { color } from '../../tokens';
import { CONTACT_EMAIL } from '../../lib/brand';
import type { MisreadFacts } from '../../lib/misread-report';
import { Pressable } from './Pressable';

const MisreadPanel = lazy(() => import('./MisreadPanel'));

/**
 * "Read it wrong? Send it to us" — the way a real misread reaches the reader.
 *
 * Closed by default: it is a favour asked of someone trying to save a receipt,
 * not a step in saving it. Opened, it shows the whole message before any mail
 * app does, because this is the one thing here that can carry a purchase off
 * the phone (`misread-report.ts`). The link is a `mailto:`, so the app sends
 * nothing; the person's own mail app does, after they have read it and
 * changed whatever they like.
 *
 * Only the control is here. What it opens (`MisreadPanel`) arrives when it is
 * opened, from the app's own files — on the phone, from the bundle; on the
 * web, from the worker's cache — so it costs a launch nothing.
 *
 * Renders nothing until there is an address somebody reads.
 */
export function MisreadReport({ text, parsed, from }: Omit<MisreadFacts, 'version'>) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  if (!CONTACT_EMAIL) return null;

  return (
    <div data-misread style={{ marginTop: 2 }}>
      <Pressable
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13.5, fontWeight: 500, color: color.accentInk }}
      >
        Read it wrong? Send it to us
      </Pressable>
      {open && (
        <div id={panel} style={{ marginTop: 4, padding: 14, background: color.surfaceAlt, border: `1px solid ${color.borderHair}`, borderRadius: 12 }}>
          <Suspense fallback={<div style={{ minHeight: 120 }} aria-busy="true" />}>
            <MisreadPanel to={CONTACT_EMAIL} text={text} parsed={parsed} from={from} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
