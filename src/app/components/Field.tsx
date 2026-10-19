import type { ReactNode } from 'react';
import { color, font, radius } from '../../tokens';

/**
 * One labelled form row. The error is wired to the input through
 * aria-describedby and aria-invalid, so a screen reader hears why the field
 * was rejected rather than just that something on the screen went red.
 */
export function Field({
  id, label, error, hint, children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div style={{ marginTop: 14 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: color.bodyStrong, marginBottom: 6 }}>
        {label}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {error && (
        <div id={`${id}-error`} role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: color.danger, marginTop: 5 }}>
          {error}
        </div>
      )}
      {!error && hint && (
        <div id={`${id}-hint`} style={{ fontSize: 12.5, color: color.muted, marginTop: 5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function inputStyle(invalid: boolean) {
  return {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '13px 14px',
    borderRadius: radius.control,
    border: `1px solid ${invalid ? color.danger : color.border}`,
    background: color.surface,
    fontFamily: font.ui,
    fontSize: 15,
    color: color.ink,
  };
}

/** The left padding an input needs to clear a `Prefixed` adornment. */
export const PREFIXED_PAD = 30;

/**
 * A unit drawn inside the left edge of an input — the "£" before an amount —
 * so the field says what it holds before anything is typed into it. Drawn,
 * not typed: the input's value is exactly what it was without it, and the
 * glyph is hidden from screen readers because the label already says what the
 * number is. The input clears it with `paddingLeft: PREFIXED_PAD`.
 */
export function Prefixed({ prefix, children }: { prefix: string; children: ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <span
        aria-hidden="true"
        data-prefix
        style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
          fontFamily: font.figures, fontSize: 15, color: color.muted,
        }}
      >
        {prefix}
      </span>
      {children}
    </div>
  );
}
