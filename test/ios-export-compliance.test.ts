import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `ITSAppUsesNonExemptEncryption = false`, and the code that makes it true.
 *
 * Without the key, App Store Connect stops every uploaded build to ask the
 * export-compliance question, and a TestFlight build waits until someone
 * answers. With it, the answer is given once — but it is a DECLARATION to US
 * export control, and it is only true while the app's cryptography stays what
 * it is today: verifying the policy feed's signature (authentication) and
 * HTTPS through the OS. Both are exempt.
 *
 * So the declaration is held to the source rather than to a memory of it. The
 * day someone reaches for `subtle.encrypt`, or pulls in a crypto library, this
 * fails and says the plist line has to be revisited — which is a question for
 * a person, not a thing to update to make the build green.
 */
const ROOT = join(__dirname, '..');

const sources = (): { file: string; text: string }[] => {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push({ file: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') });
    }
  };
  walk(join(ROOT, 'src'));
  return out;
};

/** Every WebCrypto operation the app performs, as `file: operation`. */
const operations = (): string[] =>
  sources().flatMap(({ file, text }) => [...text.matchAll(/\bsubtle\.([a-zA-Z]+)\s*\(/g)].map((m) => `${file}: ${m[1]}`));

describe('the export-compliance declaration', () => {
  it('is made, as not using non-exempt encryption', () => {
    const plist = readFileSync(join(ROOT, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
    expect(plist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });

  it('finds the cryptography it is meant to be checking', () => {
    // A walk over nothing would call any codebase exempt.
    expect(operations().length).toBeGreaterThanOrEqual(2);
  });

  it('holds only while the app verifies signatures and nothing more', () => {
    // importKey + verify is authentication. encrypt, decrypt, wrapKey,
    // deriveKey and friends are not, and would make the plist line false.
    const allowed = new Set(['importKey', 'verify']);
    expect(operations().filter((op) => !allowed.has(op.split(': ')[1]))).toEqual([]);
  });

  it('holds only while no cryptography library is bundled', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    const crypto = Object.keys(pkg.dependencies ?? {}).filter((d) =>
      /crypto|sodium|nacl|forge|openpgp|jose|sjcl|aes|bcrypt|noble/i.test(d));
    expect(crypto).toEqual([]);
  });
});
