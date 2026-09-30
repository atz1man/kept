import { useEffect, useState } from 'react';
import { color } from '../../tokens';
import { photoAsFile, readPhoto } from '../../lib/photos';
import type { Receipt } from '../../lib/types';
import { Pressable } from './Pressable';

/**
 * A letter to the shop, and the two ways to send it. Never sent anywhere by
 * the app: Copy puts it on the clipboard; Share hands it to the phone's own
 * sheet (mail, a message, notes), where one exists.
 *
 * Shared by the fault letter and the refund chase, which want the same thing
 * from it — including the receipt's photo, which shops ask for as proof of
 * purchase in both cases.
 */
export function Letter({ letter, title, receipt }: { letter: string; title: string; receipt: Receipt }) {
  const [said, setSaid] = useState<'no' | 'copied' | 'shared' | 'failed'>('no');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  // A letter that changed is a letter not yet copied.
  useEffect(() => setSaid('no'), [letter]);
  /*
   * The receipt's own photo, where one was kept. The letter should carry it
   * rather than leave the person to find the photo again in another app. Only
   * where the share sheet says it can take a file — otherwise the text goes
   * alone.
   */
  const [photo, setPhoto] = useState<File | null>(null);
  useEffect(() => {
    let live = true;
    void readPhoto(receipt.id).then((data) => {
      if (!live || !data) return;
      const file = photoAsFile(data, receipt.store);
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) setPhoto(file);
    });
    return () => {
      live = false;
    };
  }, [receipt.id, receipt.store]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setSaid('copied');
    } catch {
      setSaid('failed');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title, text: letter, ...(photo ? { files: [photo] } : {}) });
      setSaid('shared');
    } catch (e) {
      // A closed sheet is the person changing their mind, not a failure.
      if ((e as Error)?.name !== 'AbortError') setSaid('failed');
    }
  };

  const button = {
    flex: 1, padding: 13, textAlign: 'center', borderRadius: 999, fontWeight: 700, fontSize: 14,
  } as const;

  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: color.muted, marginTop: 14, marginBottom: 6 }}>
        THE LETTER
      </div>
      <div
        aria-label="The letter"
        style={{
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.5, padding: 14,
          background: color.creamAlt, border: `1.5px solid ${color.borderHair}`, borderRadius: 12, color: color.body,
          userSelect: 'text',
        }}
      >
        {letter}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <Pressable
          className="k-cta-yellow"
          onClick={() => void copy()}
          style={{ ...button, background: color.yellow, border: `1.5px solid ${color.ink}`, color: color.ink }}
        >
          {said === 'copied' ? 'Copied ✓' : 'Copy the letter'}
        </Pressable>
        {canShare && (
          <Pressable
            className="k-row-white"
            onClick={() => void share()}
            style={{ ...button, background: color.white, border: `1.5px solid ${color.borderSoft}` }}
          >
            {said === 'shared' ? 'Shared ✓' : 'Share'}
          </Pressable>
        )}
      </div>
      {canShare && photo && (
        <div style={{ fontSize: 12.5, marginTop: 8, color: color.muted }}>
          Share sends the photo of your receipt with it, as proof of purchase.
        </div>
      )}
      {said === 'failed' && (
        <div role="status" style={{ fontSize: 12.5, marginTop: 8, color: color.danger, fontWeight: 600 }}>
          That did not work here. Select the letter above and copy it instead.
        </div>
      )}
    </>
  );
}
