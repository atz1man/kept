import { useId, useState } from 'react';
import { color, font, radius } from '../../tokens';
import { CONTACT_EMAIL } from '../../lib/brand';
import { misreadMailto, misreadReport, type MisreadFacts } from '../../lib/misread-report';
import { Pressable } from './Pressable';

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
 * Renders nothing until there is an address somebody reads.
 */
export function MisreadReport({ text, parsed, from }: Omit<MisreadFacts, 'version'>) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  if (!CONTACT_EMAIL) return null;
  const report = open ? misreadReport({ version: __KEPT_VERSION__, text, parsed, from }) : '';

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
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: color.body }}>
            This opens an email to us in your own mail app — Quids In sends nothing itself. It carries what you added
            and what was read from it, so the reader can be fixed. Email addresses, phone numbers, postcodes and the
            name in a greeting are already taken out; a street address or a name elsewhere may not be, so read it
            through and delete anything you’d rather keep.
          </div>
          <pre
            tabIndex={0}
            role="region"
            aria-label="The message that will be sent"
            style={{
              whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text', fontFamily: font.figures, fontSize: 12, lineHeight: 1.5,
              color: color.body, background: color.surface, border: `1px solid ${color.borderHair}`, borderRadius: radius.control,
              padding: '10px 12px', margin: '10px 0 0', maxHeight: 220, overflowY: 'auto',
            }}
          >
            {report}
          </pre>
          <a
            href={misreadMailto(CONTACT_EMAIL, report)}
            className="k-secondary"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 44, boxSizing: 'border-box', padding: '10px 16px',
              background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.control,
              color: color.accentInk, textDecoration: 'none', fontWeight: 600, fontSize: 14,
            }}
          >
            Email it to {CONTACT_EMAIL}<span aria-hidden="true">&nbsp;→</span>
          </a>
        </div>
      )}
    </div>
  );
}
