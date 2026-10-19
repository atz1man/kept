import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { LetterNameContext } from '../src/app/letter-name';
import { Letter } from '../src/app/components/Letter';
import { reducer, type AppState } from '../src/app/state';
import { parseBackup } from '../src/lib/backup';
import { cancelLetter } from '../src/lib/cancel-notice';
import { claimPack } from '../src/lib/claim-pack';
import { addDays, toISODate } from '../src/lib/dates';
import { faultLetter, finalRejectLetter } from '../src/lib/fault-letter';
import { toPence } from '../src/lib/money';
import { refundLetter } from '../src/lib/refund-chase';
import { MAX_LETTER_NAME, readLetterName, signedAs, signOff } from '../src/lib/sign-off';
import { DEFAULT_SETTINGS, exportBackup, freshState, hydrate, wipe } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/**
 * The name the letters are signed with.
 *
 * Every letter ended "[Your name]", with a note under it asking for the name
 * to be put in before sending. It read as a draft left unfinished, and a
 * letter copied in a hurry went to the shop signed "[Your name]". The name is
 * asked for once and kept on the phone, with the other settings; with none
 * given, the placeholder stays.
 */
const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));
const receipt = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'r', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: toPence(40),
  purchasedOn: iso(-5), windowDays: 30, policy: 'p', distance: false, status: 'kept', keptOn: iso(-4),
  ...over,
});

/** Each letter the app drafts, built for a name. */
const builders: [string, (name?: string) => string, string][] = [
  ['the fault letter', (name) => faultLetter(receipt(), TODAY, 'It leaks', name)!, ''],
  ['the final rejection', (name) => finalRejectLetter(receipt({ faultClaim: { sentOn: iso(-2) } }), TODAY, 'Still leaks', name)!, ''],
  ['the refund chase', (name) => refundLetter(receipt({ status: 'sent', sentOn: iso(-20), purchasedOn: iso(-25), distance: true, keptOn: undefined }), TODAY, name)!, ''],
  ['the cancellation notice', (name) => cancelLetter(receipt({ distance: true, status: 'active', keptOn: undefined }), name), '\n[Your address]'],
];

describe('every letter is signed with the name given', () => {
  it.each(builders)('%s ends with it', (_label, build, after) => {
    const letter = build('Jane Smith');
    expect(letter.endsWith(`Yours faithfully,\n\nJane Smith${after}`)).toBe(true);
    expect(letter).not.toContain('[Your name]');
  });

  it.each(builders)('%s keeps the placeholder with no name, an empty one or only spaces', (_label, build, after) => {
    for (const name of [undefined, '', '   ', '\n\t']) {
      expect(build(name).endsWith(`Yours faithfully,\n\n[Your name]${after}`)).toBe(true);
    }
  });

  it('is signed as tidied, not as typed: trimmed, one space between words', () => {
    expect(signOff({ name: '  Jane \n Smith ' })).toEqual(['Yours faithfully,', '', 'Jane Smith']);
  });

  it('carries the name into the claim pack, whose letters are the person’s own', () => {
    const r = receipt({ distance: true, cancelledOn: iso(-4), faultClaim: { sentOn: iso(-2), what: 'Leaks' } });
    const signed = claimPack(r, TODAY, 'Jane Smith').letters;
    expect(signed.length).toBe(2);
    for (const l of signed) expect(l.text).toMatch(/Yours faithfully,\n\nJane Smith/);
    for (const l of claimPack(r, TODAY).letters) expect(l.text).toContain('[Your name]');
  });
});

describe('a letter drafted without the name, signed where it is shown', () => {
  const unsigned = faultLetter(receipt(), TODAY, 'The lid says [Your name] on it')!;

  it('puts the name on the signature line and nowhere else', () => {
    const signed = signedAs(unsigned, 'Jane Smith');
    expect(signed.endsWith('Yours faithfully,\n\nJane Smith')).toBe(true);
    // The person's own words are theirs, even when they spell the placeholder.
    expect(signed).toContain('The lid says [Your name] on it.');
  });

  it('keeps the address blank under the name', () => {
    const notice = cancelLetter(receipt({ distance: true, status: 'active', keptOn: undefined }));
    expect(signedAs(notice, 'Jane Smith').endsWith('Yours faithfully,\n\nJane Smith\n[Your address]')).toBe(true);
  });

  it('leaves the letter alone with no name', () => {
    expect(signedAs(unsigned, '')).toBe(unsigned);
    expect(signedAs(unsigned, '   ')).toBe(unsigned);
    expect(signedAs(unsigned, undefined)).toBe(unsigned);
  });
});

describe('what is believed as a name', () => {
  it('is a string, trimmed and capped', () => {
    expect(readLetterName('  Jane Smith  ')).toBe('Jane Smith');
    expect(readLetterName('x'.repeat(500))).toHaveLength(MAX_LETTER_NAME);
    for (const v of [42, true, null, undefined, {}, ['Jane'], '   ']) expect(readLetterName(v)).toBe('');
  });
});

describe('kept on the phone, with the settings', () => {
  const stored = (settings: unknown) => ({ version: 1, receipts: [], updates: [], onboardingSeen: true, settings, alertsSent: [] });

  it('is no name until one is given', () => {
    expect(DEFAULT_SETTINGS.letterName).toBe('');
    expect(freshState(TODAY).settings.letterName).toBe('');
  });

  it('survives a reload', () => {
    const state = { ...freshState(TODAY), settings: { ...DEFAULT_SETTINGS, letterName: 'Jane Smith' } };
    expect(hydrate(JSON.parse(JSON.stringify(state)), TODAY).settings.letterName).toBe('Jane Smith');
  });

  it('is read as a name or not at all, and one bad field leaves the others', () => {
    expect(hydrate(stored({ ...DEFAULT_SETTINGS, letterName: '  Jane  ' }), TODAY).settings.letterName).toBe('Jane');
    expect(hydrate(stored({ ...DEFAULT_SETTINGS, letterName: 'x'.repeat(500) }), TODAY).settings.letterName).toHaveLength(MAX_LETTER_NAME);
    const odd = hydrate(stored({ ...DEFAULT_SETTINGS, urgentDays: 9, letterName: { first: 'Jane' } }), TODAY).settings;
    expect(odd.letterName).toBe('');
    expect(odd.urgentDays).toBe(9);
  });
});

const appState = (over: Partial<AppState> = {}): AppState => ({
  ...freshState(TODAY), receipts: [receipt()],
  screen: 'settings', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, justSwapped: null, restored: null,
  ...over,
});

describe('in the backup, which is the person’s own file', () => {
  it('goes out in the export and comes back on restore', () => {
    const state = appState({ settings: { ...DEFAULT_SETTINGS, letterName: 'Jane Smith' } });
    const file = exportBackup(state);
    expect(JSON.parse(file).settings.letterName).toBe('Jane Smith');
    const read = parseBackup(file);
    expect(read.ok && read.summary.letterName).toBe('Jane Smith');
    const onNewPhone = reducer(appState({ receipts: [] }), { type: 'restore', backup: read.ok ? read.summary : { receipts: [], skipped: 0 } }, TODAY);
    expect(onNewPhone.settings.letterName).toBe('Jane Smith');
  });

  it('is checked on the way in, as every other field of a file is', () => {
    const file = (letterName: unknown) => JSON.stringify({ app: 'kept', version: 1, receipts: [receipt()], settings: { letterName } });
    const nameIn = (letterName: unknown) => {
      const read = parseBackup(file(letterName));
      return read.ok ? read.summary.letterName ?? '' : 'refused';
    };
    expect(nameIn('  Jane  Smith ')).toBe('Jane Smith');
    expect(nameIn('x'.repeat(500))).toHaveLength(MAX_LETTER_NAME);
    expect(nameIn(7)).toBe('');
    expect(nameIn({ evil: true })).toBe('');
    expect(nameIn('   ')).toBe('');
    // A file with no settings at all is still a backup.
    const bare = parseBackup(JSON.stringify({ app: 'kept', version: 1, receipts: [receipt()] }));
    expect(bare.ok && bare.summary.letterName).toBeUndefined();
  });

  it('never overwrites the name this phone already has, as a restore never overwrites a receipt', () => {
    const here = appState({ settings: { ...DEFAULT_SETTINGS, letterName: 'J. Smith' } });
    const after = reducer(here, { type: 'restore', backup: { receipts: [], skipped: 0, letterName: 'Jane Smith' } }, TODAY);
    expect(after.settings.letterName).toBe('J. Smith');
    const none = reducer(appState(), { type: 'restore', backup: { receipts: [], skipped: 0, letterName: '' } }, TODAY);
    expect(none.settings.letterName).toBe('');
  });
});

describe('Erase everything', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('takes the name, and keeps the preferences it always kept', () => {
    const named = appState({ settings: { ...DEFAULT_SETTINGS, urgentDays: 10, letterName: 'Jane Smith' } });
    const after = reducer(named, { type: 'wipe' }, TODAY);
    expect(after.settings.letterName).toBe('');
    expect(after.settings.urgentDays).toBe(10);
  });

  it('takes it off the disk too, so the next launch does not sign with it', () => {
    const cells = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      location: { search: '' },
      localStorage: { getItem: (k: string) => cells.get(k) ?? null, setItem: (k: string, v: string) => void cells.set(k, v), removeItem: (k: string) => void cells.delete(k) },
    };
    cells.set('kept.v1', JSON.stringify({ version: 1, receipts: [receipt()], onboardingSeen: true, settings: { ...DEFAULT_SETTINGS, urgentDays: 10, letterName: 'Jane Smith' } }));
    wipe();
    const disk = JSON.parse(cells.get('kept.v1')!);
    expect(disk.receipts).toEqual([]);
    expect(disk.settings.letterName).toBeUndefined();
    expect(disk.settings.urgentDays).toBe(10);
    expect(hydrate(disk, TODAY).settings.letterName).toBe('');
  });
});

describe('the letter on screen', () => {
  const letter = faultLetter(receipt(), TODAY, 'It leaks')!;
  const draw = (name: string, setName?: (n: string) => void) =>
    renderToStaticMarkup(
      createElement(LetterNameContext.Provider, { value: { name, setName } },
        createElement(Letter, { letter, title: 'Faulty goods: Kettle', receipt: receipt() })),
    );

  it('is signed with the name, with no note asking for it', () => {
    const html = draw('Jane Smith', () => {});
    expect(html).toContain('Yours faithfully,\n\nJane Smith');
    expect(html).not.toContain('[Your name]');
    expect(html).not.toMatch(/Sign it as/);
  });

  it('asks for the name right under the letter when there is none', () => {
    const html = draw('', () => {});
    expect(html).toContain('[Your name]');
    expect(html).toMatch(/<label[^>]*for="sign-letter"[^>]*>Sign it as…<\/label>/);
    expect(html).toMatch(/<input[^>]*id="sign-letter"/);
    // The letter keeps the names the sweeps find it by.
    expect(html).toContain('aria-label="The letter"');
    expect(html).toContain('Copy the letter');
  });

  it('keeps the old note where nothing can keep a name', () => {
    const html = draw('');
    expect(html).not.toMatch(/Sign it as/);
    expect(html).toContain('Put your name where the letter says [Your name] before you send it.');
  });
});
