import { useEffect, useState } from 'react';
import { color, font, radius } from '../../tokens';
import { supportDetails, type SupportFacts } from '../../lib/support';
import { gatherSupportFacts } from '../support-facts';
import { Pressable } from './Pressable';

/**
 * The version, and the details a person can send when they write in — shown
 * in full before anything is copied, because "what gets sent" is a question
 * this app answers by showing, not by promising. Used by Settings and by the
 * recovery screen, where it carries the error that broke the render.
 */
export function SupportDetails({ receipts, error }: { receipts: SupportFacts['receipts']; error?: SupportFacts['error'] }) {
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    let live = true;
    void gatherSupportFacts(receipts, error).then((f) => {
      if (live) setText(supportDetails(f));
    });
    return () => {
      live = false;
    };
  }, [receipts, error]);

  const copy = async () => {
    // Fresh at the moment of copying: the time, and the storage, move.
    const now = supportDetails(await gatherSupportFacts(receipts, error));
    setText(now);
    try {
      await navigator.clipboard.writeText(now);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };

  const version = text?.split('\n')[0] ?? `Kept ${__KEPT_VERSION__}`;
  return (
    <div data-support>
      <div style={{ fontFamily: font.figures, fontSize: 13.5, fontWeight: 600, color: color.bodyStrong }}>{version}</div>
      <Pressable
        className="k-row-white k-secondary"
        onClick={() => void copy()}
        style={{ marginTop: 10, padding: 12, textAlign: 'center', background: color.white, border: `1px solid ${color.border}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
      >
        Copy details for support
      </Pressable>
      <div role="status" aria-live="polite" style={{ fontSize: 12.5, marginTop: 6, color: copied === 'failed' ? color.danger : color.muted, minHeight: 18 }}>
        {copied === 'copied'
          ? 'Copied — paste it into your message.'
          : copied === 'failed'
            ? 'Couldn’t copy here — select the text below instead.'
            : 'Version, device and counts only — nothing about what you bought.'}
      </div>
      <details open={copied === 'failed'} style={{ marginTop: 4 }}>
        <summary style={{ fontSize: 13, fontWeight: 600, color: color.accentInk, cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}>
          What gets copied
        </summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text', fontFamily: font.figures, fontSize: 12, lineHeight: 1.5, color: color.body, background: color.white, borderRadius: radius.control, padding: '10px 12px', margin: '6px 0 0' }}>
          {text ?? '…'}
        </pre>
      </details>
    </div>
  );
}
