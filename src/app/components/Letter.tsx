import { useEffect, useState } from 'react';
import { color, radius } from '../../tokens';
import { photoAsFile, readPhoto } from '../../lib/photos';
import { MAX_LETTER_NAME, readLetterName, signedAs, YOUR_ADDRESS, YOUR_NAME } from '../../lib/sign-off';
import { useLetterName } from '../letter-name';
import { inputStyle } from './Field';
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
export function Letter({ letter: drafted, title, receipt, name = 'letter' }: {
  letter: string;
  title: string;
  receipt: Receipt;
  /**
   * What the letter is called on screen: "The letter", "Copy the letter".
   * Two letters on one screen need two names — the fault panel shows the
   * first letter and the final rejection together, and a screen reader heard
   * two boxes called "The letter" and two buttons called "Copy the letter".
   * The default is the name every other letter has always had.
   */
  name?: string;
}) {
  /*
   * Signed here, with the name kept in the settings, so every letter is signed
   * the same way whichever screen drafted it. With no name, the placeholder
   * stays, and the field under the letter asks for one — right here, because
   * a person halfway through a letter should not have to leave it for
   * Settings. Asked for once: the field stays on screen for this visit, so
   * the name can be typed and corrected without it vanishing at the first
   * letter, and is not offered again once there is a name.
   */
  const { name: signer, setName } = useLetterName();
  const letter = signedAs(drafted, signer);
  const [asking] = useState(() => !readLetterName(signer));
  const askName = asking && !!setName;
  const fieldId = `sign-${name.replace(/\W+/g, '-')}`;
  const nameBlank = letter.includes(YOUR_NAME);
  const addressBlank = letter.includes(YOUR_ADDRESS);
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
    flex: 1, padding: 13, textAlign: 'center', borderRadius: radius.control, fontWeight: 600, fontSize: 14,
  } as const;

  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: color.bodyStrong, marginTop: 14, marginBottom: 6 }}>
        The {name}
      </div>
      <div
        aria-label={`The ${name}`}
        style={{
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.5, padding: 14,
          background: color.surfaceAlt, border: `1px solid ${color.borderHair}`, borderRadius: 10, color: color.body,
          userSelect: 'text',
        }}
      >
        {letter}
      </div>
      {askName && (
        <div style={{ marginTop: 10 }}>
          {/* "Sign it as" on the first letter. A second letter on the same
              screen (the final rejection, above the first) names itself, so
              the two fields are not two boxes with one name; neither name
              contains "The letter", which the letter's own box is found by. */}
          <label htmlFor={fieldId} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: color.bodyStrong, marginBottom: 6 }}>
            {name === 'letter' ? 'Sign it as…' : `Sign the ${name.replace(/ letter$/, '')} as…`}
          </label>
          <input
            id={fieldId}
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={MAX_LETTER_NAME}
            placeholder="Your name"
            value={signer}
            onChange={(e) => setName?.(e.target.value)}
            aria-describedby={`${fieldId}-hint`}
            style={inputStyle(false)}
          />
          <div id={`${fieldId}-hint`} style={{ fontSize: 12.5, marginTop: 5, color: color.muted }}>
            Saved on this phone and used for every letter. You can change it in Settings.
          </div>
        </div>
      )}
      {((nameBlank && !askName) || addressBlank) && (
        <div style={{ fontSize: 12.5, marginTop: 6, color: color.muted }}>
          {nameBlank && !askName
            ? `Put your name where the letter says [Your name]${addressBlank ? ', and your address under it,' : ''} before you send it.`
            : 'Put your address under your name before you send it.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <Pressable
          className="k-primary"
          onClick={() => void copy()}
          style={{ ...button, background: color.accent, border: 0, color: color.white }}
        >
          {said === 'copied' ? 'Copied ✓' : `Copy the ${name}`}
        </Pressable>
        {canShare && (
          <Pressable
            className="k-row-white"
            onClick={() => void share()}
            // "Share" on its own is a fine name until a second letter is on
            // screen; then it says which, and still starts with what it shows.
            aria-label={name === 'letter' ? undefined : `Share the ${name}`}
            style={{ ...button, background: color.surface, border: `1px solid ${color.borderSoft}` }}
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
          That did not work here. Select the {name} above and copy it instead.
        </div>
      )}
    </>
  );
}
