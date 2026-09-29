# Policy Watch — the monthly routine

The Watch tab tells people when a shop changes its returns policy, and a
change in the feed can set the window of a new purchase. So nothing reaches
the feed that someone cannot check against the retailer's own page.

Until the first real change is published, the tab shows five labelled
samples; the first real entry replaces them.

## Once a month (and whenever a change is reported)

1. **Read the pages.** On a machine that can reach the shops:

   ```
   npm run check:retailers
   ```

   It opens each shop's own returns page and writes every sentence that states
   a window to `store/retailer-check/<date>.md`, quoted, with the URL.

2. **Compare with last month's report.** A sentence that changed is a
   candidate. Read it in context on the page — "30 days" beside "for members"
   or "unopened" is not the window a person gets.

3. **Publish each real change** with the page you read it on:

   ```
   npm run feed:add -- --id u_currys_window_30 --store Currys \
     --changed 2026-10-01 --window 30 \
     --text "Currys now gives 30 days from delivery for a change of mind." \
     --note "new purchases get 30 days from delivery" \
     --source https://www.currys.co.uk/help/returns-and-cancellations
   ```

   It refuses a source on any host but the retailer's own (so a news story or
   a search result cannot be cited), a shop the table does not know, a date in
   the future, and an id already published unless `--replace` marks a
   correction. `--window` only when the change moved the window.

4. **Correct the table too.** A changed window is a change to `stores.ts` for
   the next build; the feed carries it to installed apps until then.

5. **Sign and commit.** If the feed key is configured (APN-19):
   `npm run feed:sign`. Commit `public/policy-feed.json` (and the `.sig`), and
   the month's report beside it.

## What the app does with an entry

- It drops any downloaded entry without an https `source` and the date it was
  read (`readFeed`).
- The Watch tab shows the change with "Read on currys.co.uk, 1 October 2026",
  linking to the page.
- A receipt bought before the change keeps the window it was bought under; a
  new purchase gets the new one (`windowInForceFor`).
