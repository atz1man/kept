/**
 * How every letter to a shop ends: the close, and the name it is from.
 *
 * Each letter stopped at "Yours faithfully," with nothing under it, and a
 * letter pasted into an email and sent like that reaches a shop's returns
 * team from nobody. The cancellation notice needs more than a name: the
 * model form in Schedule 3 to the 2013 Regulations asks for the consumer's
 * name AND address, so it carries both.
 *
 * Signed with the name the person gave, where they gave one (Settings, or the
 * field under any letter), and kept on the phone with the other settings. It
 * was always a placeholder, "[Your name]", with a note under the letter asking
 * for it to be changed before sending — which read as a draft left unfinished,
 * and a letter copied in a hurry went to the shop signed "[Your name]". The
 * placeholder stays for anyone who has not given a name: the app does not
 * guess one. The address is still a placeholder for everybody; the app has no
 * reason to hold one for the single letter that asks for it.
 */
export const YOUR_NAME = '[Your name]';
export const YOUR_ADDRESS = '[Your address]';

/**
 * The longest name kept. Generous for a name — it is a signature line, not a
 * field anything else reads — and short enough that a pasted paragraph does
 * not become one.
 */
export const MAX_LETTER_NAME = 80;

/**
 * A stored or restored name, believed only as a string: trimmed, inner runs
 * of space (a line break pasted in included) made one, and capped. Anything
 * else is no name.
 */
export function readLetterName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LETTER_NAME).trim();
}

export function signOff({ address = false, name }: { address?: boolean; name?: string } = {}): string[] {
  return ['Yours faithfully,', '', readLetterName(name) || YOUR_NAME, ...(address ? [YOUR_ADDRESS] : [])];
}

/**
 * A letter already drafted, signed with the name now given.
 *
 * For the one place a letter is drafted by a screen that does not know the
 * name (the refund chase, on the receipt's own screen) and shown by `Letter`,
 * which does. Only the signature line is touched: the placeholder on a line of
 * its own after the close, never the same words typed into the description of
 * a fault.
 */
export function signedAs(letter: string, name: string | undefined): string {
  const n = readLetterName(name);
  if (!n) return letter;
  const close = `Yours faithfully,\n\n${YOUR_NAME}`;
  const at = letter.lastIndexOf(close);
  if (at < 0) return letter;
  const after = letter.slice(at + close.length);
  if (after !== '' && !after.startsWith('\n')) return letter;
  return `${letter.slice(0, at)}Yours faithfully,\n\n${n}${after}`;
}

/** Whether a letter still has a blank for the person to fill in. */
export function hasBlanks(letter: string): boolean {
  return letter.includes(YOUR_NAME) || letter.includes(YOUR_ADDRESS);
}
