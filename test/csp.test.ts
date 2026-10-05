import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, policyFor, withPolicy } from '../src/lib/csp';

const parse = (policy: string) =>
  new Map(
    policy.split(';').map((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      return [name, sources] as const;
    }),
  );
const directives = parse(CONTENT_SECURITY_POLICY);

describe('the content security policy', () => {
  it('names no host but this one, so nothing can be fetched from or sent to anywhere else', () => {
    // A CDN, an analytics host or an error reporter added here would be the
    // privacy page's "nothing leaves your device" undone in one line.
    for (const [name, sources] of directives) {
      for (const s of sources) expect(["'self'", "'none'", 'data:', 'blob:'], `${name} ${s}`).toContain(s);
    }
  });

  it('runs only the scripts this build ships: none inline, no eval', () => {
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'none'"]);
  });

  it('goes first in the head, ahead of everything it governs', () => {
    const page = withPolicy('<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8" />\n  <script type="module" src="/a.js"></script>\n</head></html>');
    const meta = page.indexOf('http-equiv="Content-Security-Policy"');
    expect(meta).toBeGreaterThan(page.indexOf('<head>'));
    expect(meta).toBeLessThan(page.indexOf('<script'));
    expect(page).toContain(`content="${CONTENT_SECURITY_POLICY}"`);
  });

  it('writes the policy it is given, so a build with a feed host carries that one', () => {
    const policy = policyFor('https://feed.example');
    expect(withPolicy('<html><head></head></html>', policy)).toContain(`content="${policy}"`);
  });

  it('refuses to build a page it cannot protect', () => {
    expect(() => withPolicy('<html><body></body></html>')).toThrow(/no <head>/);
  });
});

describe('the policy of a build given a feed origin', () => {
  /*
   * The iPhone app can only fetch a newer feed from a real host, so a build
   * may name one (VITE_FEED_ORIGIN, lib/feed-origin.ts). That host is the one
   * thing the policy may add, and only where a fetch needs it.
   */
  const ORIGIN = 'https://feed.example';
  const configured = parse(policyFor(ORIGIN));

  it('is the default policy when none is configured, so the default build names no host', () => {
    expect(policyFor(undefined)).toBe(CONTENT_SECURITY_POLICY);
    expect(policyFor('')).toBe(CONTENT_SECURITY_POLICY);
  });

  it('adds exactly that origin to connect-src, and nothing else anywhere', () => {
    expect(configured.get('connect-src')).toEqual([...directives.get('connect-src')!, ORIGIN]);
    expect([...configured.keys()]).toEqual([...directives.keys()]);
    for (const [name, sources] of configured) {
      if (name === 'connect-src') continue;
      expect(sources, name).toEqual(directives.get(name));
    }
  });

  it('adds it normalised, as the origin the app fetches from', () => {
    expect(parse(policyFor(`${ORIGIN}/`)).get('connect-src')).toEqual(configured.get('connect-src'));
  });

  it('refuses anything that is not an https origin rather than writing it into the policy', () => {
    for (const raw of ['http://feed.example', 'https://feed.example/feeds', 'https://*.example', "'unsafe-inline'", 'https://a.example https://b.example']) {
      expect(() => policyFor(raw), raw).toThrow(/VITE_FEED_ORIGIN/);
    }
  });
});
