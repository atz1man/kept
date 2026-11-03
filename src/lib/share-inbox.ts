/**
 * What the iPhone's share extension hands the app (packages/share-inbox).
 *
 * Someone shares an order email's text, a PDF of an order, or a screenshot
 * from another app; the extension keeps it in the App Group container on the
 * phone and the app collects it the next time it is in front. Apple does not
 * let a share extension open its app, so this is the one honest route — and
 * the item goes into the same Add screen a paste or a picked file does, read
 * by the same code, so nothing about a shared order is read differently.
 */
export interface InboxItem {
  name: string;
  mime: string;
  /** The bytes, base64 — the only way the bridge carries them. */
  base64: string;
}

/** What Add should be handed: text goes in the paste box, anything else is a file. */
export type Incoming = { text: string } | { file: File };

/** Kinds the extension accepts and the Add screen can read. */
export const INBOX_TYPES = ['text/plain', 'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'text/html', 'message/rfc822'] as const;

function bytes(base64: string): Uint8Array<ArrayBuffer> {
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The item as Add wants it, or null for anything it could not read. */
export function incomingFrom(item: InboxItem | null | undefined): Incoming | null {
  if (!item || !item.base64 || !(INBOX_TYPES as readonly string[]).includes(item.mime)) return null;
  let data: Uint8Array<ArrayBuffer>;
  try {
    data = bytes(item.base64);
  } catch {
    return null;
  }
  if (item.mime === 'text/plain') {
    const text = new TextDecoder('utf-8').decode(data).trim();
    return text ? { text } : null;
  }
  return { file: new File([data], item.name || 'shared', { type: item.mime }) };
}
