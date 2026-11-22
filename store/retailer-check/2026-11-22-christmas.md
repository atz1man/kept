# Christmas returns — 22 November 2026, second pass

The 3 November pass (`2026-11-03-christmas.md`) found nothing on most shops'
pages: Christmas returns are announced through November. This pass read the
own returns page of every shop in the table that `src/lib/christmas.ts` did
not already cover — 95 shops — in a browser, for sentences about a Christmas,
festive or holiday-season period that name a 2026 or 2027 date. Twelve did.

Every row that went into `src/lib/christmas.ts` was read twice, independently:

- **First read**, for all of them: a browser (Chromium, en-GB, Europe/London)
  loading the shop's page and taking its rendered text.
- **Second read**: through a web fetch tool where the shop allowed it (John
  Lewis, Dune London). Amazon, ASOS (both 503) and Argos (403) refused that
  tool, and Beaverbrooks' page could not be parsed by it; for those four the
  second read is a separately launched browser, with a different user agent,
  loading the page again and searching it for the exact quote below. All four
  quotes were found character for character in the rendered text, and for
  Amazon, Argos and ASOS also in the HTML as served.

Left out, and why:
- Coast — "Orders placed from 30th October can be returned up until 5 January
  2027", but further down: "items must be received by us on or before 5
  January". The last day to SEND it is earlier than the date the app would
  show, which is the reason Debenhams was left out on 3 November.
- Debenhams — the same group and the same sentence as Coast, and the
  start date carries no year. Its page no longer has the "received" line, but
  Coast's has, and a present posted on the 5th and refused is the one mistake
  this table exists to prevent. Left out until both say the same.
- Cotswold Outdoor — Black Friday and sale items bought from 9 November go
  back until 10 January 2027, but as a credit note in store; full-price items
  "until Sunday 10th January" with no purchase start. Two policies and a
  credit note, not a date for a refund.
- Bonmarché — exchange only, and the purchase end is given as both 24 and 15
  December.
- Microsoft Store — "extended free returns through January 31, 2027" is on a
  marketing page; its returns page gave no text to the browser.

## Amazon — Christmas
- https://www.amazon.co.uk/gp/help/customer/display.html?nodeId=GKM69DUUYKQWKWX7 — read twice by browser (the fetch tool got 503); found in text and served HTML
  - > For the 2026 holiday season, most items purchased between November 1 and December 25, 2026 can be returned until January 31, 2027 or within 30 days from receipt (whichever is later).

## Argos — Christmas
- https://www.argos.co.uk/help/returns/ — read twice by browser (the fetch tool got 403); found in text and served HTML
  - > Items purchased from Wednesday 23rd September 2026 to Friday 25th December 2026 can be returned right up to Sunday 31st January 2027.
  - > During the Christmas period, items purchased between 23 Sept and 25 Dec can be returned up to 31 Jan.

## ASOS — Christmas
- https://www.asos.com/customer-care/returns-refunds/what-is-your-returns-policy/ — read twice by browser (the fetch tool got 503); found in text and served HTML
  - > Orders placed between 16 November 2026 and 18 December 2026 can be returned to us up until 18 January 2027.
  - > Orders placed after 18 December 2026 are subject to our regular returns timeframes outlined below.

## John Lewis — Christmas
- https://www.johnlewis.com/customer-services/returns?dt=informationOnOurReturnsPolicy — read twice, both reads agree (one by web fetch)
  - > Any gift bought between 1st October 2026 and 24 December 2026 can be returned up until 23 January 2027, if it’s unwanted or unsuitable.
  - It says "gift", which the app cannot see on a receipt, so the row carries that as its condition: the date is shown beside the receipt's own, and does not replace it.

## Dune London — Christmas
- https://www.dunelondon.com/customer-service/returns.html — read twice, both reads agree (one by web fetch)
  - > Our Christmas returns policy is valid from 9th November until 14th December 2026.
  - > Any purchases made online or in store between these dates can be returned up to and including 11th January 2027.
  - > For purchases made from 14th December 2026, our usual 28 day refund policy applies.

## Beaverbrooks — Christmas
- https://www.beaverbrooks.co.uk/info/returns — read twice by browser (the fetch tool could not parse the page); found in rendered text
  - > We’ll be happy to exchange or refund purchases made between Sunday 18 October and Sunday 6 December 2026 until Monday 4 January 2027, subject to our usual returns terms and conditions.
  - > This excludes items made or ordered specifically to your requirements, personalised items, Beaverbrooks Gift Cards and pre-owned items.
