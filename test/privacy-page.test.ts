import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The privacy policy, held to the app it describes.
 *
 * It tells someone where to go to stop the one download and the reminders —
 * "the Policy watch switch", "the Deadline alerts switch", "Erase everything".
 * A policy pointing at a control that has since been renamed is directions to
 * nowhere, on the one page where precision is the whole job. So each control
 * the page names is looked for in Settings, by the name the page uses.
 */
const ROOT = join(__dirname, '..');
const page = readFileSync(join(ROOT, 'src', 'privacy', 'Privacy.tsx'), 'utf8').replace(/\s+/g, ' ');
const settings = readFileSync(join(ROOT, 'src', 'app', 'screens', 'Settings.tsx'), 'utf8').replace(/\s+/g, ' ');

describe('the privacy page is a page', () => {
  it('is an entry in the build, so the web and the iOS bundle both serve /privacy/', () => {
    // The listing's privacy URL is checked against this path; without this the
    // listing test would be checking a string against a string.
    expect(existsSync(join(ROOT, 'privacy', 'index.html'))).toBe(true);
    expect(readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')).toMatch(/resolve\(__dirname, 'privacy\/index\.html'\)/);
  });

  it('is reachable from inside the app, which guideline 5.1.1 asks for', () => {
    expect(settings).toMatch(/href="\/privacy\/"/);
  });

  it('has the #contact anchor the listing’s support URL points at', () => {
    expect(page).toMatch(/id="contact"/);
  });
});

describe('the controls it names', () => {
  const switches = [...page.matchAll(/with the ([A-Z][A-Za-z]*(?: [a-z]+)*) switch/g)].map((m) => m[1]);

  it('finds the ones it is meant to be checking', () => {
    expect(switches.length).toBeGreaterThanOrEqual(2);
  });

  it('names only switches Settings actually has', () => {
    const labels = [...settings.matchAll(/<Toggle label="([^"]+)"/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(switches.filter((s) => !labels.includes(s))).toEqual([]);
  });

  it('names the erase control by the words on it', () => {
    expect(page).toContain('Erase everything in Settings');
    expect(settings).toContain('Erase everything');
  });

  it('names the restore control by the words on it, and Settings shows it', () => {
    const offer = readFileSync(join(ROOT, 'src', 'app', 'components', 'UnlockOffer.tsx'), 'utf8');
    expect(page).toContain('Restore purchase in Settings');
    expect(offer).toContain("'Restore purchase'");
    expect(settings).toContain('<UnlockOffer');
  });
});

describe('where the iPhone keeps it', () => {
  /*
   * The page said a receipt photograph was stored "inside the app, and nowhere
   * else". Info.plist opts in to `UIFileSharingEnabled`, which puts the
   * Documents folder — the photographs and the mirror of every receipt — in
   * the Files app, and Documents is in the iPhone's own backup, which is the
   * reason the mirror lives there. Both are the person's own device and
   * nothing kept sends; neither was said. Held to the files that decide it, so
   * the page cannot drift from the build again.
   */
  const plist = readFileSync(join(ROOT, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
  const mirror = readFileSync(join(ROOT, 'src', 'lib', 'mirror.ts'), 'utf8');
  const photos = readFileSync(join(ROOT, 'src', 'lib', 'photos.ts'), 'utf8');

  it('says the folder shows in the Files app, while the build shares it', () => {
    expect(plist).toMatch(/<key>UIFileSharingEnabled<\/key>\s*<true\/>/);
    expect(page).toContain('appears in the Files app under On My iPhone');
  });

  it('says it goes into the iPhone’s own backup, while the mirror and photos live in Documents', () => {
    expect(mirror).toContain('Directory.Documents');
    expect(photos).toContain('Directory.Documents');
    expect(page).toContain('part of your iPhone’s own backup');
  });

  it('no longer claims a photograph is nowhere but inside the app', () => {
    expect(page).not.toMatch(/inside the app, and nowhere else/);
  });
});

describe('what it says about itself', () => {
  it('opens with the sentence the app shows, word for word', () => {
    const statement = 'Everything lives on this device. No account, nothing uploaded, no one reading your purchases.';
    expect(settings).toContain(statement);
    expect(page).toContain(statement);
  });
});
