import { describe, expect, it } from 'vitest';
import { FEED_PATH, FEED_SIG_PATH, feedLocation, feedOrigin, feedRefreshes } from '../src/lib/feed-origin';

/*
 * Whether the app fetches a newer list of policy changes, and from where.
 *
 * Inside the iPhone app a relative `/policy-feed.json` is the bundle, so the
 * "update" was always the copy that shipped while four surfaces said it
 * downloaded. One answer now decides the fetch and every sentence about it.
 */
describe('whether a newer list is fetched', () => {
  it('always on the web, with or without a configured host', () => {
    expect(feedRefreshes(false, null)).toBe(true);
    expect(feedRefreshes(false, 'https://feed.example')).toBe(true);
  });

  it('in the iPhone app only once its build names a host', () => {
    expect(feedRefreshes(true, null)).toBe(false);
    expect(feedRefreshes(true, 'https://feed.example')).toBe(true);
  });
});

describe('where it is fetched from', () => {
  it('keeps the relative path on the web, whatever the build was given', () => {
    // The web's own origin is where its feed lives.
    expect(feedLocation(false, null)).toEqual({ feed: FEED_PATH, sig: FEED_SIG_PATH });
    expect(feedLocation(false, 'https://feed.example')).toEqual({ feed: FEED_PATH, sig: FEED_SIG_PATH });
  });

  it('fetches nothing in the iPhone app with no host — not the copy in its own bundle', () => {
    expect(feedLocation(true, null)).toBeNull();
  });

  it('fetches from the configured host in the iPhone app, feed and signature alike', () => {
    expect(feedLocation(true, 'https://feed.example')).toEqual({
      feed: 'https://feed.example/policy-feed.json',
      sig: 'https://feed.example/policy-feed.sig',
    });
  });
});

describe('the configured origin', () => {
  it('is none when unset or empty', () => {
    expect(feedOrigin(undefined)).toBeNull();
    expect(feedOrigin('')).toBeNull();
  });

  it('takes an https origin, with or without the trailing slash', () => {
    expect(feedOrigin('https://feed.example')).toBe('https://feed.example');
    expect(feedOrigin('https://feed.example/')).toBe('https://feed.example');
    expect(feedOrigin('https://feed.example:8443')).toBe('https://feed.example:8443');
  });

  it.each([
    ['plain http', 'http://feed.example'],
    ['no scheme', 'feed.example'],
    ['a path', 'https://feed.example/feeds'],
    ['a query', 'https://feed.example/?x=1'],
    ['a fragment', 'https://feed.example/#x'],
    ['credentials', 'https://user:pw@feed.example'],
    ['a host the parser would rewrite', 'https://Feed.Example'],
    ['a wildcard', 'https://*.example'],
    ['two origins', 'https://a.example https://b.example'],
    ['a CSP keyword', "'self'"],
  ])('refuses %s, loudly', (_why, raw) => {
    expect(() => feedOrigin(raw)).toThrow(/VITE_FEED_ORIGIN must be an https origin/);
  });

  it('refuses a value that is not a string', () => {
    expect(() => feedOrigin(42)).toThrow(/VITE_FEED_ORIGIN/);
  });
});
