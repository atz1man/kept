/**
 * The money-back card, as a picture a person can post.
 *
 * "Share the win" put one sentence on the clipboard. That is the right
 * fallback and the wrong ceiling: what people actually send each other is a
 * picture, and the card on the Celebrate screen is already designed to be
 * one. This draws the same card, from the same tokens, at 1080 × 1350 (the
 * 4:5 portrait every feed shows whole), on the phone. Nothing is uploaded to
 * make it; it goes wherever the person's own share sheet sends it.
 *
 * What it says is what the Celebrate card says, and no more: the amount, the
 * shop, whether it went back inside the shop's window, and the running total.
 * Never the item, which is the one detail on a receipt that is nobody else's
 * business.
 */
import { color, font } from '../tokens';

export const WIN_CARD = { width: 1080, height: 1350 } as const;

export interface WinCard {
  amount: string;
  store: string;
  /** Null when nobody can say: a floor deadline (`deadlineIsFloor`) had passed. */
  inTime: boolean | null;
  recovered: string;
}

/**
 * The sentence under the amount, shared with the screen so the two cannot
 * drift. Says nothing about timing it cannot stand behind: past the earliest
 * day an online order's window could close, with the arrival never entered,
 * "after the window had closed" was a guess about a return possibly made in
 * time, printed on a card made to be shared.
 */
export function winCardLine(store: string, inTime: boolean | null): string {
  if (inTime === null) return `Recovered from ${store}.`;
  return inTime
    ? `Recovered from ${store} before the window closed.`
    : `Recovered from ${store}, after the shop’s own window had closed.`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The card as a PNG, or null where this browser cannot draw one. */
export async function renderWinCard(card: WinCard): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = WIN_CARD.width;
  canvas.height = WIN_CARD.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // The self-hosted faces, loaded before drawing: a canvas does not wait for
  // them, and a card drawn in the fallback face is a different card.
  await Promise.all([
    document.fonts?.load(`700 200px ${font.figures}`),
    document.fonts?.load(`600 40px ${font.ui}`),
  ]).catch(() => undefined);

  const pad = 96;
  const inner = WIN_CARD.width - pad * 2;

  // The card a person posts: white, like the screen it came from.
  ctx.fillStyle = color.white;
  ctx.fillRect(0, 0, WIN_CARD.width, WIN_CARD.height);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color.ink;
  ctx.font = `700 64px ${font.display}`;
  ctx.fillText('kept.', pad, 170);

  ctx.fillStyle = color.muted;
  ctx.font = `600 36px ${font.figures}`;
  ctx.fillText('Money back', pad, 430);

  // The amount, as large as fits: £9.99 and £1,299.00 both fill the line.
  let size = 220;
  ctx.font = `700 ${size}px ${font.figures}`;
  while (ctx.measureText(card.amount).width > inner && size > 80) {
    size -= 8;
    ctx.font = `700 ${size}px ${font.figures}`;
  }
  ctx.fillStyle = color.accentInk;
  ctx.fillText(card.amount, pad - 6, 430 + size * 0.95);

  ctx.fillStyle = color.body;
  ctx.font = `500 46px ${font.ui}`;
  let y = 430 + size * 0.95 + 100;
  for (const line of wrap(ctx, winCardLine(card.store, card.inTime), inner)) {
    ctx.fillText(line, pad, y);
    y += 62;
  }

  const rule = 1080;
  ctx.strokeStyle = color.border;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pad, rule);
  ctx.lineTo(WIN_CARD.width - pad, rule);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `500 38px ${font.figures}`;
  ctx.fillStyle = color.muted;
  ctx.fillText('Kept back so far', pad, rule + 80);
  ctx.fillStyle = color.accentInk;
  ctx.font = `700 38px ${font.figures}`;
  ctx.textAlign = 'right';
  ctx.fillText(card.recovered, WIN_CARD.width - pad, rule + 80);

  ctx.textAlign = 'center';
  ctx.fillStyle = color.muted;
  ctx.font = `500 32px ${font.figures}`;
  ctx.fillText('Kept — return deadlines, watched', WIN_CARD.width / 2, WIN_CARD.height - 90);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
