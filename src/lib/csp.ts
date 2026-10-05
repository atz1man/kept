/**
 * The Content-Security-Policy every page of the built app carries, as a
 * <meta> written in by vite.config.ts (`contentSecurityPolicy`).
 *
 * Why it exists. The app reads things other people wrote — order emails, saved
 * web pages, PDFs, a signed policy feed — and keeps a person's purchases on
 * their device. React never renders any of that as markup, and nothing should
 * ever run that this build did not ship. Without a policy, nothing said so:
 * measured on main, a <script> added to the running app ran, and a request to
 * any host on the internet went out. With it, the browser refuses both, so a
 * mistake in any one reader cannot become code running beside a library, or a
 * library leaving the device.
 *
 * What each line allows, and why no more:
 *  - script-src 'self' — this build's own bundles. No inline script, no eval.
 *  - style-src 'self' — the stylesheets this build ships. React's style
 *    props are set through the DOM, which a policy does not govern, so the
 *    screens need nothing more; the claim pack's own <style> is in a file the
 *    person saves, which this policy never reaches.
 *  - img-src data: blob: — receipt photos are held as data URLs and drawn
 *    through blobs; neither reaches a server.
 *  - connect-src 'self' data: blob: — the feed, the deploy check and the
 *    reader's files are all on this origin; data: and blob: are local. No
 *    other host, which is the privacy page's promise written where the
 *    browser enforces it.
 *  - worker-src 'self' blob: — the PDF reader's and the photo reader's
 *    workers, and the service worker, all served from here.
 *  - frame-src 'self' — the landing page shows the app itself as its demo.
 *  - object-src 'none', base-uri 'none', form-action 'self' — the three ways
 *    round a script policy that need nothing to be allowed.
 *
 * Not here, and cannot be in a <meta>: frame-ancestors (who may frame these
 * pages) and reporting. Both belong in a response header, which needs the
 * host — see store/SUBMISSION.md.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

/** The page with the policy as the first thing in its head, ahead of anything it governs. */
export function withPolicy(html: string): string {
  const at = html.indexOf('<head>');
  if (at < 0) throw new Error('kept: a page with no <head> cannot carry the content security policy');
  const end = at + '<head>'.length;
  return `${html.slice(0, end)}\n  <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />${html.slice(end)}`;
}
