import { registerPlugin } from '@capacitor/core';
import { isNative } from '../lib/mirror';
import { incomingFrom, intentStart, type InboxItem, type Incoming, type IntentStart } from '../lib/share-inbox';

/**
 * Collecting what the share extension left (src/lib/share-inbox.ts).
 *
 * Taking it empties the inbox, so a shared order is offered once: the same
 * rule the web share target follows, for the same reason — a second offer of
 * the same order is how it gets saved twice.
 */
interface ShareInboxPlugin {
  take(): Promise<{ item: InboxItem | null; open?: string | null }>;
}

const ShareInbox = registerPlugin<ShareInboxPlugin>('ShareInbox');

/**
 * What arrived while the app was away: a shared item, and/or a Siri or
 * Shortcuts action asking for Add (`add`) or the camera (`scan`).
 */
export async function takeShared(): Promise<(Incoming & { start?: IntentStart }) | { start: IntentStart } | null> {
  if (!isNative()) return null;
  try {
    const { item, open } = await ShareInbox.take();
    const incoming = incomingFrom(item);
    const start = intentStart(open);
    if (incoming) return start ? { ...incoming, start } : incoming;
    return start ? { start } : null;
  } catch (e) {
    console.warn('share inbox not read', e);
    return null;
  }
}
