import { createContext, useContext } from 'react';

/**
 * The name letters are signed with, for the components that show a letter.
 *
 * Read from the settings and handed down by App, rather than threaded through
 * every screen that shows a letter: the refund chase is drafted on the
 * receipt's own screen, and `Letter` — which every letter goes out through —
 * is where the name is put on it and where it is asked for. `setName` is
 * absent where nothing can keep a name (a component rendered on its own), and
 * the letter then keeps the placeholder and the note, as it always had.
 */
export interface LetterName {
  name: string;
  setName?: (name: string) => void;
}

export const LetterNameContext = createContext<LetterName>({ name: '' });

export function useLetterName(): LetterName {
  return useContext(LetterNameContext);
}
