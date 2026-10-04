import type { OrderEmail } from './order-emails';

/**
 * The order-email corpus, re-encoded the ways those emails actually travel:
 * as a saved message (multipart, a base64 plain part and a quoted-printable
 * HTML part) and as the HTML itself. Built from the corpus rather than written
 * again, so every layout the parser is held to as text it is held to as a
 * file too — and a new layout added to the corpus is covered here the day it
 * is added.
 *
 * The HTML is the shape order emails take: a table, the label in one cell and
 * the figure in the next. That is the part a careless HTML-to-text gets wrong
 * — "Total" and "£89.00" on two lines — so it is the part these test.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/£/g, '&pound;');

/** One row per line; a line ending in a figure puts the figure in its own cell. */
export function asHtml(e: OrderEmail): string {
  const rows = e.text.split('\n').map((line) => {
    const m = /^(.*?)\s+(-?£[\d,]+(?:\.\d{2})?)$/.exec(line.trim());
    return m
      ? `<tr><td style="padding:4px">${esc(m[1])}</td><td align="right">${esc(m[2])}</td></tr>`
      : `<tr><td colspan="2"><p>${esc(line)}</p></td></tr>`;
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Your order</title><style>td{font:14px sans-serif}</style></head>
<body><!-- preheader --><table width="600" cellpadding="0">${rows.join('\n')}</table>
<script>track()</script></body></html>`;
}

/** Quoted-printable, wrapped at 76 with soft breaks, as a mail client writes it. */
function qp(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let line = '';
  const out: string[] = [];
  for (const b of bytes) {
    const ch = b === 0x0a ? '\n' : b >= 33 && b <= 126 && b !== 61 ? String.fromCharCode(b) : b === 32 ? ' ' : `=${b.toString(16).toUpperCase().padStart(2, '0')}`;
    if (ch === '\n') {
      out.push(line);
      line = '';
      continue;
    }
    if (line.length + ch.length > 75) {
      out.push(`${line}=`);
      line = '';
    }
    line += ch;
  }
  out.push(line);
  return out.join('\r\n');
}

const b64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/.{1,76}/g, '$&\r\n').trim();
};

/** The sender a shop's order email comes from, or an unknown shop's. */
export function sender(e: OrderEmail): string {
  return e.expect.store ? `"${e.expect.store}" <orders@mail.example>` : 'orders@mail.example';
}

/** A saved order email: both parts, encoded, a UTF-8 subject in an encoded word. */
export function asEml(e: OrderEmail, opts: { plain?: boolean; pdf?: Uint8Array } = {}): string {
  const boundary = '----=_Part_kept_1';
  const inner = '----=_Part_kept_2';
  const alternative = [
    `Content-Type: multipart/alternative; boundary="${inner}"`,
    '',
    ...(opts.plain === false ? [] : [`--${inner}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(e.text)]),
    `--${inner}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    qp(asHtml(e)),
    `--${inner}--`,
  ];
  const attachment = opts.pdf
    ? [
        `--${boundary}`,
        'Content-Type: application/pdf; name="invoice.pdf"',
        'Content-Disposition: attachment; filename="invoice.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        btoa(String.fromCharCode(...opts.pdf)).replace(/.{1,76}/g, '$&\r\n').trim(),
      ]
    : [];
  return [
    'Return-Path: <bounce@mail.example>',
    'Received: from mail.example by mx.example; Mon, 28 Sep 2026 09:00:00 +0100',
    `From: ${sender(e)}`,
    'To: you@example.com',
    `Subject: =?UTF-8?B?${b64('Your order — thank you').replace(/\s/g, '')}?=`,
    'Date: Mon, 28 Sep 2026 09:00:00 +0100',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed;\r\n boundary="${boundary}"`,
    '',
    `--${boundary}`,
    ...alternative,
    ...attachment,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/** A file name for a corpus entry: "amazon-delivered-with-a-subtotal-and-postage". */
export const slug = (e: OrderEmail) => e.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
