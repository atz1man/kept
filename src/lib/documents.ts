import { parseReceiptText } from './parse';

/**
 * Receipts that arrive as FILES rather than as text or a photo: the PDF a shop
 * attaches or links ("your e-receipt"), the order email saved out of a mail
 * app as .eml, the order page saved as .html.
 *
 * The app read two things — a pasted email and a photographed till receipt —
 * and the commonest digital receipt of all, the PDF, was not one of them: a
 * John Lewis e-receipt or an Apple invoice had to be opened elsewhere, its
 * text selected and pasted, and on a phone a PDF's text often cannot be
 * selected at all. Everything here turns a file into the same plain text the
 * paste parser already reads, so there is one parser and one set of rules,
 * whichever way a receipt came in.
 *
 * All of it on the phone, which is the decision this was built on: nothing is
 * uploaded to be read. Pure functions over bytes and strings, so they run in
 * the unit suite as they run in the app; `src/app/documents.ts` is the thin
 * part that needs a browser (pdf.js, the canvas, the camera's reader).
 */

export type DocKind = 'image' | 'pdf' | 'email' | 'html' | 'text' | 'unknown';

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/**
 * What a file is, from its first bytes — not its name, which a share sheet or
 * a mail app may have changed ("attachment.bin", "receipt" with no extension)
 * — and from its name and type only when the bytes say nothing.
 */
export function kindOf(name: string, type: string, head: Uint8Array): DocKind {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return 'image'; // PNG
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return 'image'; // GIF
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image';
  // HEIC/HEIF, which is what an iPhone's camera saves: an ISO box, `ftyp`, then a brand.
  if (ascii(head, 4, 8) === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1|avif)$/.test(ascii(head, 8, 12))) return 'image';

  const text = new TextDecoder('utf-8', { fatal: false }).decode(head).replace(/^﻿/, '');
  // A message starts with header lines, and an order email is a message.
  if (/^(?:(?:Return-Path|Received|Delivered-To|MIME-Version|From|To|Subject|Date|Message-ID|Content-Type|X-[\w-]+):[^\n]*\r?\n(?:[ \t][^\n]*\r?\n)*){2,}/i.test(text)) return 'email';
  if (/^\s*(?:<!doctype html|<html|<head|<body|<meta|<table|<div)/i.test(text)) return 'html';

  const lower = name.toLowerCase();
  if (type === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (type === 'message/rfc822' || lower.endsWith('.eml')) return 'email';
  if (type === 'text/html' || /\.html?$/.test(lower)) return 'html';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('text/') || lower.endsWith('.txt')) return 'text';
  // Mostly printable is text: a receipt saved from somewhere with no name at all.
  const printable = [...head].filter((c) => c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)).length;
  return head.length > 0 && printable / head.length > 0.95 ? 'text' : 'unknown';
}

// ── HTML ──────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", pound: '£', euro: '€', cent: '¢',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', times: '×',
  copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', zwnj: '', zwj: '', shy: '',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}

/**
 * An HTML order email or page as the lines a person reads on it.
 *
 * Never rendered, only read: no DOM, so a page cannot run anything and the
 * same function runs in the unit suite. Blocks end lines and table cells sit
 * side by side, because an order email is a layout of tables — "Total" in one
 * cell and "£89.00" in the next is ONE line to the parser, and was two.
 */
export function htmlToText(html: string): string {
  let s = upToLast(html, '-->', (t) => t.replace(/<!--[\s\S]*?-->/g, ''));
  s = dropRawText(s);
  s = upToLast(s, '>', (t) =>
    t
      .replace(/<br\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|header|footer|blockquote|address|ul|ol|dl|dt|dd)\s*>/gi, '\n')
      .replace(/<(p|div|tr|li|h[1-6]|table)\b[^>]*>/gi, '\n')
      .replace(/<\/(td|th)\s*>/gi, ' \t')
      .replace(/<[^>]+>/g, ''),
  );
  return decodeEntities(s)
    .split('\n')
    .map((l) => l.replace(/[ \t ​]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/*
 * Why the tag patterns are not simply run over the whole file. Each one starts
 * at a "<" and runs to the ">" that closes it, and where there IS no closing
 * ">" the engine starts again at the next "<" and runs to the end once more —
 * once per "<", so a file of 56 KB that never closes a tag took half a second
 * and a megabyte would take minutes, on the main thread, with the app frozen.
 * A broken export or a hostile attachment is enough. Nothing these patterns
 * remove can END after the last ">" (or "-->"), so they run over the text up to
 * it and the rest is kept as it is: the same result, without the rescans.
 */
function upToLast(s: string, end: string, f: (t: string) => string): string {
  const cut = s.lastIndexOf(end) + end.length;
  return cut < end.length ? s : f(s.slice(0, cut)) + s.slice(cut);
}

const RAW_TEXT = /<(script|style|head|title|noscript|template)\b/gi;
const CLOSES = new Map<string, RegExp>();

/**
 * <style>…</style> and the like, with what is inside them: never words a person
 * reads. Written as a loop rather than one pattern because an opening tag that
 * is never closed made the pattern search to the end of the file for EVERY
 * opening after it; here, once one name has no closing tag left, no later
 * opening of it can have one either, and it is not searched for again.
 */
function dropRawText(s: string): string {
  const unclosed = new Set<string>();
  let out = '';
  let from = 0;
  RAW_TEXT.lastIndex = 0;
  for (let m = RAW_TEXT.exec(s); m; m = RAW_TEXT.exec(s)) {
    const name = m[1].toLowerCase();
    if (unclosed.has(name)) continue;
    let close = CLOSES.get(name);
    if (!close) CLOSES.set(name, (close = new RegExp(`<\\/${name}\\s*>`, 'gi')));
    close.lastIndex = RAW_TEXT.lastIndex;
    if (!close.exec(s)) {
      unclosed.add(name);
      continue;
    }
    out += s.slice(from, m.index);
    from = RAW_TEXT.lastIndex = close.lastIndex;
  }
  return out + s.slice(from);
}

// ── Email ─────────────────────────────────────────────────────────────────

/** Bytes as a string of one char per byte, the form a MIME message is parsed in. */
export function bytesToBinary(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
}

const binaryToBytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

/**
 * Bytes in the charset a part declares. UTF-8 is read strictly: a body that
 * declares none, or declares UTF-8 and is not, is far more often Windows-1252
 * than anything else — a Latin-1 "£" is the single byte A3, which UTF-8 turns
 * into "�", and that was a price with no currency on it.
 */
function decodeCharset(bytes: Uint8Array, charset: string): string {
  const cs = (charset || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(cs, { fatal: cs === 'utf-8' || cs === 'utf8' }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function quotedPrintable(s: string): Uint8Array {
  return binaryToBytes(s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))));
}

function base64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, '');
  try {
    return binaryToBytes(atob(clean));
  } catch {
    return new Uint8Array();
  }
}

/** =?utf-8?Q?Your_order?= and =?UTF-8?B?…?= in a header, as text. */
function decodeWords(s: string): string {
  return s
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=/gi, (_, cs: string, enc: string, data: string) =>
      decodeCharset(enc.toUpperCase() === 'B' ? base64(data) : quotedPrintable(data.replace(/_/g, ' ')), cs),
    );
}

interface Headers {
  get(name: string): string | null;
}

function splitMessage(raw: string): { headers: Headers; body: string } {
  const at = raw.search(/\r?\n\r?\n/);
  const head = at < 0 ? raw : raw.slice(0, at);
  const body = at < 0 ? '' : raw.slice(at).replace(/^\r?\n\r?\n/, '');
  const fields = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line);
    if (m && !fields.has(m[1].toLowerCase())) fields.set(m[1].toLowerCase(), m[2]);
  }
  return { headers: { get: (n) => fields.get(n.toLowerCase()) ?? null }, body };
}

const param = (header: string | null, name: string) =>
  header ? (new RegExp(`(?:^|;)\\s*${name}\\*?=\\s*(?:"([^"]*)"|([^;\\s]*))`, 'i').exec(header)?.slice(1).find((v) => v !== undefined) ?? null) : null;

export interface Attachment {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export interface ReadEmail {
  subject: string | null;
  /** The sender's display name, or the address where there is none. */
  from: string | null;
  /** When it was sent, from the Date header. */
  sent: Date | null;
  /** Each readable body as text, plain first: an order email usually sends both. */
  bodies: string[];
  /** PDFs it carries — an invoice is often the attachment, not the body. */
  attachments: Attachment[];
}

/** One MIME part, and its parts, into the bodies and attachments found so far. */
function walk(raw: string, out: { plain: string[]; html: string[]; attachments: Attachment[] }, depth = 0): void {
  if (depth > 8) return;
  const { headers, body } = splitMessage(raw);
  const type = (headers.get('content-type') ?? 'text/plain').split(';')[0].trim().toLowerCase();
  if (type.startsWith('multipart/')) {
    const boundary = param(headers.get('content-type'), 'boundary');
    if (!boundary) return;
    const marker = `--${boundary}`;
    const parts = body.split(marker).slice(1);
    for (const part of parts) {
      if (part.startsWith('--')) break;
      walk(part.replace(/^\r?\n/, ''), out, depth + 1);
    }
    return;
  }
  if (type === 'message/rfc822') {
    walk(body, out, depth + 1);
    return;
  }
  const encoding = (headers.get('content-transfer-encoding') ?? '').trim().toLowerCase();
  const bytes = encoding === 'base64' ? base64(body) : encoding === 'quoted-printable' ? quotedPrintable(body) : binaryToBytes(body);
  const disposition = headers.get('content-disposition') ?? '';
  const name = decodeWords(param(disposition, 'filename') ?? param(headers.get('content-type'), 'name') ?? '');
  if (type === 'application/pdf' || (type === 'application/octet-stream' && /\.pdf$/i.test(name))) {
    out.attachments.push({ name: name || 'attachment.pdf', type: 'application/pdf', bytes });
    return;
  }
  if (/^attachment/i.test(disposition)) return;
  const charset = param(headers.get('content-type'), 'charset') ?? 'utf-8';
  if (type === 'text/plain') out.plain.push(decodeCharset(bytes, charset));
  else if (type === 'text/html') out.html.push(htmlToText(decodeCharset(bytes, charset)));
}

/** A saved email — an .eml file — as what it says and what it carries. */
export function readEmail(raw: string): ReadEmail {
  const { headers } = splitMessage(raw);
  const found = { plain: [] as string[], html: [] as string[], attachments: [] as Attachment[] };
  walk(raw, found);
  const fromHeader = headers.get('from');
  // Runs of spaces are made one first: the pattern below tries each length of a
  // run against the next, which made a From line of 80,000 spaces take seconds.
  const from = fromHeader ? decodeWords(fromHeader).replace(/\s+/g, ' ').replace(/^\s*"?([^"<]*?)"?\s*<([^>]+)>.*$/, (_, n: string, a: string) => n.trim() || a).trim() : null;
  const dateHeader = headers.get('date');
  const sent = dateHeader ? new Date(dateHeader) : null;
  return {
    subject: headers.get('subject') ? decodeWords(headers.get('subject')!).trim() : null,
    from: from || null,
    sent: sent && !Number.isNaN(sent.getTime()) ? sent : null,
    bodies: [...found.plain, ...found.html].map((b) => b.trim()).filter(Boolean),
    attachments: found.attachments,
  };
}

/**
 * The email as one text for the parser: who sent it and what about, then the
 * body. The sender line is what names the shop in an email whose body never
 * does ("Thanks for your order!" from "ASOS <orders@asos.com>"), and the
 * subject often carries the order number.
 *
 * The day it was SENT is said as that and nothing more: an order
 * confirmation is sent the day of the order, a dispatch or delivery email is
 * not, and the parser should not be handed one as the other.
 */
export function emailAsText(e: ReadEmail, body: string): string {
  return [
    ...(e.from ? [`From: ${e.from}`] : []),
    ...(e.subject ? [`Subject: ${e.subject}`] : []),
    '',
    body,
  ].join('\n');
}

// ── PDF ───────────────────────────────────────────────────────────────────

/** One run of text on a PDF page, where pdf.js put it: x right, y UP from the bottom. */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** pdf.js's own text item, as much of it as is read here. */
export interface PdfJsItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

/** pdf.js's items as positioned runs; marked-content entries (no `str`) are dropped. */
export function fromPdfJs(items: readonly PdfJsItem[]): PdfTextItem[] {
  return items
    .filter((i): i is Required<PdfJsItem> => typeof i.str === 'string' && Array.isArray(i.transform))
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width ?? 0, height: i.height || Math.abs(i.transform[3]) || 10 }));
}

/**
 * A PDF's text runs as the lines they sit on.
 *
 * pdf.js hands back runs in content-stream order, which is the order the
 * document was DRAWN, not read: an invoice draws its column of labels, then
 * its column of figures, and joining the runs in that order puts "Total" and
 * "£89.00" thirty lines apart. Runs are grouped by height on the page instead,
 * top to bottom, and each line left to right, with a space where there is a
 * visible gap.
 */
export function pdfLines(pages: PdfTextItem[][]): string {
  return pages
    .map((items) => {
      const runs = items.filter((i) => i.str.trim() !== '');
      const lines: { y: number; tol: number; runs: PdfTextItem[] }[] = [];
      for (const run of [...runs].sort((a, b) => b.y - a.y)) {
        const tol = Math.max(2, (run.height || 10) * 0.5);
        const line = lines.find((l) => Math.abs(l.y - run.y) <= Math.max(tol, l.tol));
        if (line) line.runs.push(run);
        else lines.push({ y: run.y, tol, runs: [run] });
      }
      return lines
        .map((l) => {
          const sorted = l.runs.sort((a, b) => a.x - b.x);
          let text = '';
          let end = -Infinity;
          for (const r of sorted) {
            const gap = r.x - end;
            const space = text && !/\s$/.test(text) && !/^\s/.test(r.str) && gap > (r.height || 10) * 0.15;
            text += (space ? ' ' : '') + r.str;
            end = r.x + r.width;
          }
          return text.replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Whether a PDF is a picture of a receipt rather than a document with text in
 * it — a scan, or a photo saved as PDF. Those have to be read like a photo.
 */
export function looksScanned(text: string): boolean {
  return text.replace(/\s/g, '').length < 20;
}

// ── Choosing ──────────────────────────────────────────────────────────────

/** How much a reading of a document yields: shop, total, date, item, order number. */
export function yieldOf(text: string, today: Date): number {
  const out = parseReceiptText(text, today);
  if (!out.ok) return 0;
  const v = out.value;
  // Shop and total count double: without them there is no receipt to save.
  return 2 * Number(v.store !== null) + 2 * Number(v.amount !== null) + Number(v.dateFound) + Number(v.item !== null) + Number(v.orderRef !== null);
}

/** Of several readings of one document, the one the parser gets most from; the first on a tie. */
export function bestReading(texts: readonly string[], today: Date): string | null {
  let best: string | null = null;
  let score = -1;
  for (const t of texts) {
    const s = yieldOf(t, today);
    if (s > score) {
      best = t;
      score = s;
    }
  }
  return best;
}
