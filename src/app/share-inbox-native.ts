import { registerPlugin } from '@capacitor/core';
import { isNative } from '../lib/mirror';
import { incomingFrom, type InboxItem, type Incoming } from '../lib/share-inbox';

/**
 * Collecting what the share extension left (src/lib/share-inbox.ts).
 *
 * Taking it empties the inbox, so a shared order is offered once: the same
 * rule the web share target follows, for the same reason — a second offer of
 * the same order is how it gets saved twice.
 */
interface ShareInboxPlugin {
  take(): Promise<{ item: InboxItem | null }>;
}

const ShareInbox = registerPlugin<ShareInboxPlugin>('ShareInbox');

export async function takeShared(): Promise<Incoming | null> {
  if (!isNative()) return null;
  try {
    const { item } = await ShareInbox.take();
    return incomingFrom(item);
  } catch (e) {
    console.warn('share inbox not read', e);
    return null;
  }
}
