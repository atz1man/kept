# TestFlight — what the first testers are for

Quids In measures nothing about the people using it — no analytics, no crash
reporting, nothing leaves the phone. That is the privacy promise, and it
means the only feedback before launch is what testers tell you. So decide
now what you need to learn, and ask for exactly that.

## Who

Five to ten people who shop online in the UK and return things: at least
two who return often, one who never keeps receipts, one on an older iPhone.
Not people who will be kind about it.

## What to ask them to do, in the first week

1. Install, skip or read the welcome, and delete the five samples.
2. Add three real purchases: one by copying the order email and pasting it
   on the Add screen, one from Mail by selecting the order's text and
   choosing Share → Quids In, and one by photographing a paper receipt.
3. When Quids In offers reminders after your first real receipt, turn them on
   (iOS asks once), then leave the app alone.
4. Return one thing, or mark one returned, and mark one you are keeping.
   Say what the app said each time.

## What to ask them afterwards

Ask these in this order. The first two are the product.

1. **Did an alert arrive before something was due? When, and was it the
   right day?** (iOS alerts have never run on a real phone before TestFlight.)
2. **Did any deadline look wrong to you?** Which shop, what the app said,
   what the shop's own page or receipt says. (Every one of these is a table
   fix: see POLICY-WATCH.md.)
3. **Which order email did the paste get wrong?** Ask them to tap **Read it
   wrong? Send it to us** under the card when it happens. It shows the whole
   message first, with email addresses, phone numbers, postcodes and the
   name in a greeting already taken out, and sends from their own mail app —
   ask them to add one line saying what was wrong. Each one goes into
   `test/fixtures/order-emails.ts`, and the share of pastes that needed it
   is the number issue #16 is waiting for.
   And **which paper receipt did the scan misread?** The shop, the total or
   the date — a photo of the receipt helps, with the card number covered. The
   scan has only been tested on rendered images; real thermal paper is the
   open question.
4. When did the keyboard cover what you were typing? (APN-23)
5. What did you expect to find that was not there?
6. Would you keep it on your phone after the first return? Why not?

## What counts as a failure

- An alert that never came, or came after the deadline — stop and fix
  before submitting.
- A deadline later than the shop honours — table fix before submitting.
- A lost receipt, for any reason — stop and fix before submitting.
- Everything else is a list for after launch.

## Where the answers go

`Send feedback` in Settings opens a mail to `CONTACT_EMAIL`
(`src/lib/brand.ts`) and prints the address, and a misread sent from the Add
screen arrives at the same one. Somebody has to read that inbox during the
test: a tester who sends three misreads and hears nothing sends no fourth.
