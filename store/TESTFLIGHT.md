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
2. Add three real purchases by copying the order email and pasting it on
   the Add screen. (There is no iPhone share-sheet entry yet: that is a
   native share extension, built on a Mac. The web app's share target works
   in Chrome on Android and desktop.)
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
3. **Which order email did the paste get wrong?** Forward it, with personal
   details removed — it goes into `test/fixtures/order-emails.ts`.
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

`Send feedback` in Settings, once `CONTACT_EMAIL` in `src/lib/brand.ts` is
set, opens a mail to it and prints the address. Until then, collect answers
however suits the testers — the questions matter more than the channel.
