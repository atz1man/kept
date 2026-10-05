import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, withPolicy } from '../src/lib/csp';

const directives = new Map(
  CONTENT_SECURITY_POLICY.split(';').map((d) => {
    const [name, ...sources] = d.trim().split(/\s+/);
    return [name, sources] as const;
  }),
);

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

  it('refuses to build a page it cannot protect', () => {
    expect(() => withPolicy('<html><body></body></html>')).toThrow(/no <head>/);
  });
});
