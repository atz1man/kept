import { useEffect, useState } from 'react';
import { color, radius } from '../../tokens';
import { isNative } from '../../lib/mirror';
import { deletePhoto, readPhoto, savePhoto } from '../../lib/photos';
import { Pressable } from './Pressable';

/**
 * The paper receipt itself.
 *
 * What a shop actually asks for at the counter is proof of purchase, and for a
 * counter purchase that is the slip. The app has always had a disabled button
 * promising to SCAN one; this keeps the picture without pretending to read it,
 * and the wording says so — reading it is a separate problem with a separate
 * failure mode, and a number this app got wrong from a blurry thermal print
 * would be worse than no number at all.
 *
 * Native only. There is no camera path on the web build and nowhere to put a
 * megabyte if there were, so the whole control is absent rather than disabled:
 * a disabled button on a browser would be promising something that is not
 * coming to a browser.
 *
 * It asks the disk rather than taking a flag's word for it — see photos.ts for
 * why there is no `photo` field on the receipt.
 */
export function ReceiptPhoto({ receiptId }: { receiptId: string }) {
  const [data, setData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    void readPhoto(receiptId).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [receiptId]);

  if (!isNative()) return null;

  const take = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const shot = await Camera.getPhoto({
        quality: 70,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true,
      });
      if (!shot.base64String) return;
      const ok = await savePhoto(receiptId, shot.base64String);
      // A write that did not land must not leave a picture on screen that is
      // not on the disk — the same rule the failed-save banner exists for.
      if (ok) setData(shot.base64String);
      else setFailed(true);
    } catch {
      // Cancelling the camera is the ordinary case and is not a failure.
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await deletePhoto(receiptId);
    setData(null);
  };

  return (
    <div style={{ background: color.white, border: `1.5px solid ${color.border}`, borderRadius: radius.card, padding: 14, marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: color.muted, marginBottom: 8 }}>
        THE PAPER RECEIPT
      </div>
      {data ? (
        <>
          <img
            src={`data:image/jpeg;base64,${data}`}
            alt="The paper receipt for this purchase"
            style={{ width: '100%', borderRadius: radius.card, border: `1.5px solid ${color.border}`, display: 'block' }}
          />
          <Pressable
            onClick={() => void remove()}
            style={{ marginTop: 10, padding: '10px 14px', borderRadius: 999, border: `1.5px solid ${color.border}`, background: color.white, fontSize: 13, fontWeight: 700 }}
          >
            Remove the photo
          </Pressable>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: color.muted, lineHeight: 1.5, marginBottom: 10 }}>
            Kept keeps the picture on this phone. It does not read it — the shop, total and date are the ones you
            entered.
          </div>
          <Pressable
            className="k-ink"
            disabled={busy}
            onClick={() => void take()}
            style={{ padding: '12px 16px', borderRadius: 999, background: color.ink, color: color.cream, fontSize: 13.5, fontWeight: 700 }}
          >
            {busy ? 'Opening the camera…' : 'Photograph the receipt'}
          </Pressable>
          {failed && (
            <div role="alert" style={{ fontSize: 12.5, color: color.danger, fontWeight: 600, marginTop: 8 }}>
              That photo could not be saved, so it has not been kept. There may be no room left on the phone.
            </div>
          )}
        </>
      )}
    </div>
  );
}
