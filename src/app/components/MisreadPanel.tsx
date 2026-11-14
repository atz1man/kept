import { color, font, radius } from '../../tokens';
import { misreadMailto, misreadReport, type MisreadFacts } from '../../lib/misread-report';

/**
 * The opened half of `MisreadReport`: the message, shown in full, and the
 * mail link that carries exactly it.
 *
 * In a file of its own so it, and `misread-report.ts` with it, load when
 * someone opens the panel rather than at every launch. The app's first load
 * was 218 bytes under its ceiling (`npm run budget`), and this is something
 * most launches never show.
 */
export default function MisreadPanel({ to, text, parsed, from }: Omit<MisreadFacts, 'version'> & { to: string }) {
  const report = misreadReport({ version: __KEPT_VERSION__, text, parsed, from });
  return (
    <>
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
        href={misreadMailto(to, report)}
        className="k-secondary"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 44, boxSizing: 'border-box', padding: '10px 16px',
          background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.control,
          color: color.accentInk, textDecoration: 'none', fontWeight: 600, fontSize: 14,
        }}
      >
        Email it to {to}<span aria-hidden="true">&nbsp;→</span>
      </a>
    </>
  );
}
