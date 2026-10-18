/**
 * How every letter to a shop ends: the close, and the name it is from.
 *
 * Each letter stopped at "Yours faithfully," with nothing under it, and a
 * letter pasted into an email and sent like that reaches a shop's returns
 * team from nobody. The cancellation notice needs more than a name: the
 * model form in Schedule 3 to the 2013 Regulations asks for the consumer's
 * name AND address, so it carries both.
 *
 * Placeholders, in brackets, because the app holds no name and should not
 * ask for one to write a letter it never sends: the person fills them in
 * where they paste it, and `Letter` says so beneath any letter that has them.
 */
export const YOUR_NAME = '[Your name]';
export const YOUR_ADDRESS = '[Your address]';

export function signOff({ address = false }: { address?: boolean } = {}): string[] {
  return ['Yours faithfully,', '', YOUR_NAME, ...(address ? [YOUR_ADDRESS] : [])];
}

/** Whether a letter still has a blank for the person to fill in. */
export function hasBlanks(letter: string): boolean {
  return letter.includes(YOUR_NAME) || letter.includes(YOUR_ADDRESS);
}
