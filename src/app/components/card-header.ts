import type { CSSProperties } from 'react';

/** The vertical padding of a panel card on the receipt screen. */
export const CARD_PAD_Y = 15;

/**
 * A panel's header, the button that opens it, made as tall as the band of
 * card it sits in rather than the line of text it holds.
 *
 * "Something wrong with it?", "Cancel the order in writing" and the legal
 * rights header were buttons 18–19px tall inside a card padded 15px above
 * and below: the card looked like the thing to tap and only the text line
 * was. Measured on a 390px screen; Apple asks for 44pt, and these were the
 * only controls in the app under 24px. Taking the card's padding into the
 * button and giving it back as a negative margin leaves every pixel where it
 * was and makes the header 49px tall. scripts/a11y.mjs fails a control under
 * 24px on any screen it walks.
 */
export const cardHeaderHit: CSSProperties = { margin: `-${CARD_PAD_Y}px 0`, padding: `${CARD_PAD_Y}px 0` };
