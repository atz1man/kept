/**
 * Writes test/fixtures/documents/*.pdf: each order email in the corpus,
 * printed to PDF by a real PDF writer (LibreOffice), so the PDF reader is
 * tested on files with a real text layer rather than on items made up to
 * suit it. Run by hand when the corpus grows; the PDFs are committed, since
 * CI has no LibreOffice.
 *
 *   node --experimental-strip-types scripts/make-document-fixtures.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ORDER_EMAILS } from '../test/fixtures/order-emails.ts';
import { asHtml, slug } from '../test/fixtures/documents.ts';

const out = new URL('../test/fixtures/documents/', import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), 'kept-pdf-'));
for (const e of ORDER_EMAILS) writeFileSync(join(work, `${slug(e)}.html`), asHtml(e));
execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', work, ...readdirSync(work).filter((f) => f.endsWith('.html')).map((f) => join(work, f))], { stdio: 'inherit' });
for (const f of readdirSync(work).filter((f) => f.endsWith('.pdf'))) renameSync(join(work, f), join(out, f));
console.log(`wrote ${ORDER_EMAILS.length} PDFs to ${out}`);
