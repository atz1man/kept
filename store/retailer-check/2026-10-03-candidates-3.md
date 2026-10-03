# Candidate retailers, read from their own sites — 2026-10-03

Written by `npm run check:retailers -- --candidates`. Each shop's listed returns page was read; where none was listed, or it stated no period, the homepage was opened and the shop's own Returns/Refunds links followed. The periods column counts how often each number appears in a sentence about returns: a summary to read the quotes against, never a value to copy. A shop goes into `stores.ts` by hand, from the quotes, with its returns page added to `retailer-sources.json` in the same change.

| Shop | Status | Periods named | Clock named |
|---|---|---|---|
| Home Bargains | no returns link found | — | — |
| Card Factory | read | 28 days ×2, 30 days ×2 | delivery, purchase |
| Seasalt | read | 14 days ×4, 28 days ×3, 5 days ×2, 7 days ×2 | delivery |
| Hotter | unreadable: blocked by the site | — | — |
| Mint Velvet | read | 10 days ×2, 5 days ×1, 28 days ×1 | delivery |
| Phase Eight | read | 14 days ×6, 5 days ×1, 7 days ×1, 28 days ×1, 30 days ×1 | delivery |
| Hobbs | read | 14 days ×4, 5 days ×3, 30 days ×3, 3 days ×1, 7 days ×1 | purchase, delivery |
| Whistles | read | 14 days ×13, 28 days ×3, 5 days ×1 | delivery, purchase |
| Jigsaw | read | 8 days ×1, 10 days ×1, 14 days ×1, 28 days ×1 | delivery, purchase |
| Ted Baker | read | 28 days ×5, 14 days ×1 | purchase, delivery |
| Boden | read | 14 days ×10, 30 days ×4, 5 days ×1, 7 days ×1, 365 days ×1 | delivery |
| Sweaty Betty | read | 45 days ×1 | delivery |
| Gymshark | read | 7 days ×4, 30 days ×3, 8 days ×1 | purchase, delivery |
| Oliver Bonas | read | 5 days ×6, 30 days ×4, 14 days ×1, 20 days ×1 | delivery, purchase |
| Kurt Geiger | read | 14 days ×2, 30 days ×1 | purchase, delivery |
| Dune London | read | 10 days ×4, 5 days ×2, 28 days ×1 | purchase, delivery |
| Moss | read | 14 days ×5, 7 days ×3 | delivery |
| Charles Tyrwhitt | read | 30 days ×2, 14 days ×1 | delivery, dispatch, purchase |
| Crew Clothing | read | 7 days ×2, 14 days ×2, 5 days ×1, 28 days ×1 | purchase, delivery |
| Peacocks | read | 7 days ×4, 5 days ×2, 28 days ×2 | delivery, purchase |
| Iceland | read | 14 days ×4, 5 days ×2 | delivery |
| Ocado | no window found | — | — |
| Co-op | unreadable: blocked by the site | — | — |
| Cult Beauty | read | 30 days ×3, 5 days ×1, 10 days ×1 | delivery |
| Charlotte Tilbury | read | 14 days ×2, 30 days ×2, 31 days ×1 | delivery |
| Pandora | no window found | — | — |
| Ernest Jones | unreadable: blocked by the site | — | — |
| H.Samuel | unreadable: blocked by the site | — | — |
| Goldsmiths | read | 14 days ×6, 30 days ×1 | delivery |
| Beaverbrooks | read | 30 days ×4, 5 days ×2, 10 days ×2, 14 days ×2 | purchase, delivery |
| Hotel Chocolat | read | 14 days ×8, 28 days ×2, 30 days ×2 | dispatch, delivery |
| LEGO | read | 35 days ×2, 2 days ×1 | delivery |
| Disney Store | no window found | — | — |
| Build-A-Bear | unreadable: blocked by the site | — | — |
| Foyles | unreadable: blocked by the site | — | — |
| Flying Tiger | read | 14 days ×4 | delivery |
| Muji | read | 2 days ×3, 15 days ×3, 17 days ×2, 10 days ×1, 14 days ×1, 30 days ×1 | delivery |
| Foot Locker | read | 14 days ×6, 28 days ×4 | delivery, dispatch, purchase |
| Snow+Rock | read | 14 days ×6, 30 days ×1, 100 days ×1 | purchase, delivery |
| Ellis Brigham | read | 5 days ×1, 30 days ×1 | delivery |
| Blacks | read | 14 days ×3, 28 days ×3, 5 days ×2, 10 days ×1, 30 days ×1 | purchase, delivery |
| Millets | read | 14 days ×4, 28 days ×3, 5 days ×2, 10 days ×1 | purchase, delivery |
| Trespass | read | 10 days ×3, 21 days ×3, 1 days ×1 | delivery |
| Regatta | read | 30 days ×3, 14 days ×1 | delivery, purchase |
| Rohan | no window found | — | — |
| Evans Cycles | unreadable: HTTP 502 | — | — |
| Jollyes | unreadable: blocked by the site | — | — |
| Bensons for Beds | read | 14 days ×1 | delivery |
| Dreams | read | 14 days ×4 | delivery |
| Loaf | unreadable: blocked by the site | — | — |
| Sofology | read | 14 days ×4, 7 days ×1, 30 days ×1 | delivery |
| ScS | unreadable: blocked by the site | — | — |
| Barker and Stonehouse | read | 14 days ×4 | delivery |
| Mamas & Papas | read | 30 days ×1 | — |
| Littlewoods | unreadable: blocked by the site | — | — |
| JD Williams | read | 28 days ×6, 5 days ×1 | delivery |
| Simply Be | unreadable: blocked by the site | — | — |
| Jacamo | read | 28 days ×6, 5 days ×1 | delivery |
| Freemans | read | 14 days ×19, 10 days ×5, 60 days ×5, 5 days ×2, 7 days ×1, 28 days ×1 | purchase, delivery |
| QVC | unreadable: HTTP 418 | — | — |
| Topps Tiles | read | 30 days ×5, 14 days ×4, 10 days ×3, 7 days ×1, 365 days ×1 | delivery, purchase |
| Selco | read | 28 days ×3, 14 days ×1 | delivery |
| Poundstretcher | read | 28 days ×2, 14 days ×1 | purchase |
| The Perfume Shop | unreadable: blocked by the site | — | — |
| Hollister | no window found | — | — |
| Abercrombie & Fitch | no window found | — | — |
| Gap | no returns link found | — | — |
| Levi's | read | 28 days ×1 | purchase |
| Jack & Jones | read | 100 days ×2 | delivery |
| Pull&Bear | no window found | — | — |
| Bershka | read | 30 days ×4 | dispatch |
| Stradivarius | no window found | — | — |
| Massimo Dutti | read | 30 days ×1 | purchase |
| COS | unreadable: blocked by the site | — | — |
| & Other Stories | unreadable: blocked by the site | — | — |
| Arket | unreadable: blocked by the site | — | — |
| Accessorize | read | 14 days ×3, 30 days ×2, 60 days ×1 | delivery, purchase |
| Ann Summers | read | 28 days ×2 | purchase |
| Thorntons | read | 14 days ×4 | delivery |
| Moonpig | read | 14 days ×1 | delivery |
| Funky Pigeon | read | 14 days ×5, 30 days ×3 | delivery, purchase |
| Microsoft Store | read | 60 days ×9 | delivery |
| Dell | read | 14 days ×9 | purchase, delivery |
| Lenovo | read | 14 days ×4 | delivery, purchase |
| HP Store | read | 14 days ×1 | delivery |
| Scan Computers | unreadable: blocked by the site | — | — |
| Overclockers UK | unreadable: blocked by the site | — | — |
| Laptops Direct | read | 14 days ×3, 30 days ×1 | delivery |
| Appliances Direct | read | 28 days ×1, 30 days ×1 | delivery |
| Hughes | read | 14 days ×4, 30 days ×1 | delivery |
| Euronics | read | 30 days ×1 | delivery |
| Sonos | read | 15 days ×1, 30 days ×1 | — |
| Bose | read | 30 days ×4 | delivery |
| Harvey Nichols | unreadable: HTTP 502 | — | — |
| Fortnum & Mason | read | 14 days ×5, 30 days ×3 | delivery, purchase |
| Joe Browns | read | 14 days ×4, 28 days ×1 | delivery |
| Sosandar | read | 14 days ×2, 7 days ×1 | delivery |
| Hush | unreadable: blocked by the site | — | — |
| Nobody's Child | read | 14 days ×7, 30 days ×5, 7 days ×1 | delivery, purchase |
| ME+EM | read | 14 days ×7, 7 days ×3, 21 days ×1 | delivery |
| Rixo | read | 10 days ×2, 14 days ×2, 7 days ×1 | delivery |
| Free People | unreadable: blocked by the site | — | — |
| Anthropologie | unreadable: blocked by the site | — | — |
| Coast | read | 14 days ×8, 21 days ×4, 7 days ×2, 2 days ×1, 5 days ×1 | delivery, purchase |
| Karen Millen | read | 14 days ×4, 5 days ×1, 21 days ×1 | delivery |
| In The Style | read | 14 days ×4 | delivery, purchase |
| Quiz | no returns link found | — | — |
| Yours Clothing | unreadable: blocked by the site | — | — |
| Roman Originals | unreadable: blocked by the site | — | — |
| Damart | no window found | — | — |
| Cotton Traders | read | 14 days ×2 | delivery |
| Lands' End | read | 90 days ×8, 2 days ×4, 5 days ×2, 28 days ×2, 7 days ×1, 14 days ×1 | delivery, purchase |
| The White Company | no window found | — | — |
| Brora | unreadable: HTTP 502 | — | — |
| Toast | read | 14 days ×3, 5 days ×2, 28 days ×2, 10 days ×1 | delivery, purchase |

## Home Bargains

- https://home.bargains/ — “Home Bargains | Discount Toys, Home, Garden & more | Home Bargains” — HTTP 200
- https://help.homebargains.co.uk/hc/en-gb/articles/205395762-How-do-I-return-an-item — “Just a moment...” — **unreadable: blocked by the site**
- https://help.homebargains.co.uk/hc/en-gb/articles/200213017-What-is-your-returns-policy-for-in-store-purchases — “Just a moment...” — **unreadable: blocked by the site**

## Card Factory

- https://www.cardfactory.co.uk/customer-service/returns/returns.html — “Information About Returns” — HTTP 200
  - > They are received back at our Returns Department located at XXXXXX normally within 28 days. _(counts from delivery)_
- https://www.cardfactory.co.uk/faq.html — “FAQs” — HTTP 200
  - > We are happy to exchange or refund any unsuitable goods with a receipt, provided they are returned within 28 days of purchase and in their original condition and packaging. _(counts from purchase)_
  - > Within 30 days of purchase we are happy to provide you with an exchange or refund for faulty products. _(counts from purchase)_
  - > After 30 days we can provide you with an exchange, if we no longer have this item and there is no suitable replacement we will provide you with a refund.

## Seasalt

- https://www.seasaltcornwall.com/returns — “Returns & Refunds - Seasalt Cornwall” — HTTP 200
  - > All purchases from the 1st October 2026 until the 20th December 2026 can be returned until the 17th January 2027 (from the 20th December 2026, purchases will fall into our normal 28 days Returns policy).
  - > You have 28 days from the day you receive your purchases to return items under our voluntary promise. _(counts from delivery)_
  - > For UK and EU orders, we will refund the cost of standard outbound delivery where returns are notified within 14 days of delivery, but not premium delivery upgrades. _(counts from delivery)_
  - > After 14 days, we will refund your item, but not the delivery paid. _(counts from delivery)_
  - > Once your return has been scanned by the courier your refund will be processed and back in your account within 2-5 working days.
  - > If you're returning any items ordered from one of our Seasalt shops, please allow 5-7 working days for your refund to reach your account.
  - > Refunds will be made to the payment method used on the original order and should show within 14 working days from the date that you receive your refund confirmation email.​ ​ _(counts from delivery)_
  - > Refunds should show within 5 working days from the date of your refund receipt.​
  - > Refunds will be made to the payment method used on the original order, please allow 5-7 working days for your refund to reach your account.
  - > Refunds will be made to the payment method used on the original order and should show within 14 days from the date that you receive your refund confirmation email. _(counts from delivery)_
  - > If you've had your order for less than 28 days and you paid by Card, Gift Card or Paypal, please use our UK Returns Portal as detailed above to receive a full refund. _(counts from delivery)_

## Hotter

- https://www.hotter.com/gb/en/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.hotter.com/gb/en/info/FAQ-returning-goods — “Just a moment...” — **unreadable: blocked by the site**

## Mint Velvet

- https://mintvelvet.com/pages/returns — “Returns – Mint Velvet” — HTTP 200
  - > Choose your preferred option and return the unworn item(s) to us within 28 days for a full refund.
  - > Refunds can take up to 10 working days to process.
  - > Our UK returns usually take up to 10 working days and you will be notified as soon as the refund has been processed.
  - > For the rest of the world, we aim to process the return within 5 days of receiving the item(s). _(counts from delivery)_
- https://help.mintvelvet.com/hc/en-us/articles/4404374869393-What-is-your-returns-policy-Which-items-are-non-returnable — “What is your returns policy? Which items are non-returnable? – Mint Velvet” — HTTP 200
  - > Choose your preferred option and return the unworn item(s) to us within 28 days for a full refund.
  - > Our UK returns usually take up to 10 working days and you will be notified as soon as the refund has been processed.
  - > For the rest of the world, we aim to process the return within 5 days of receiving the item(s). _(counts from delivery)_

## Phase Eight

- https://www.phase-eight.com/returns/ — “Returns | Phase Eight UK |” — HTTP 200
  - > Need to return an online order? No problem, just send it back within 28 days of receipt _(online)_
  - > have the right to cancel your contract at any time up to 14 working days after the day
  - > Please allow 14 working days for returns to be received by our _(counts from delivery)_
  - > It can take up to 3-5 days for the refund to be processed by your bank, in addition to the
  - > After the refund date, give it 7 days for the credit to appear.
- https://www.phase-eight.com/faqs/ — “FAQs | Phase Eight UK |” — HTTP 200
  - > up to 14 days for the refund to be processed back onto your
  - > Items can be returned within 30 days of reciept or 14 days for sale items.
  - > Please allow 14 working days for returns to be received by _(counts from delivery)_
  - > Please allow up to 14 working days for your return to be

## Hobbs

- https://www.hobbs.com/shopping-with-us/return-policy.html — “Returns | Hobbs |” — HTTP 200
  - > You can return items bought online or in store with proof of purchase within 30 days of receipt. _(counts from purchase)_
  - > Sale items should be returned within 14 days of receipt.
  - > if you are contracting with us as a consumer online or by phone, you have the right to cancel your contract at any time up to 14 working days _(online)_
  - > Notification of the cancellation must be received in writing within 14 working days, _(counts from delivery)_
  - > within 3-5 working days minus any returns charge.
  - > You can return items within 30 days from the parcel delivery date. _(counts from delivery)_
  - > Once you receive an email with refund confirmation, please allow up to 7 working days for your return to be processed, and up to 5 days for your bank to credit your account. _(counts from delivery)_
  - > You can return items within 30 days of
  - > It may take up to 3 days for your return to reach our
  - > Please note it may take 3-5 days for the refund
  - > your return and you have already waited 14 working days,

## Whistles

- https://www.whistles.com/here-to-help/return-policy.html — “Returns policy |” — HTTP 200
  - > We hope you’ll love everything you order from us, but if something isn’t quite right, you have 28 days to return it.
  - > Sale items must be returned within 14 days.
  - > We will refund your purchase price, minus a £1.95 processing fee, within 14 days of receiving your return. _(counts from delivery)_
  - > Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, if you are contracting with us as a consumer online or by phone, you have the right to cancel your contract at any time up to 14 working days after the day on which you received the goods you ordered. _(online, counts from delivery)_
  - > Notification of the cancellation must be received in writing within 14 working days, starting from the day after the goods are received. _(counts from delivery)_
  - > Please return your goods to the store within 28 days of receipt, within 14 days for sale items.
  - > If your purchase is not suitable, you have 28 days from receipt to return full-price items to our warehouse or a standalone Whistles store (exclusions apply). _(counts from purchase)_
  - > You have 14 days to return sale items.
  - > Your return will take 14 working days to be delivered to our warehouse and to be processed. _(counts from delivery)_
  - > Please note it may take 3-5 days for the refund to appear in your account.
  - > Please allow the full 14 days after delivery for our returns team to process your order and refund. _(counts from delivery)_
  - > As parcels may be separated in transit, please allow the full 14 working days for all refunds to be processed.
  - > I returned my order over 14 working days ago.
  - > If you haven’t received an email confirmation of your return and have already waited 14 working days, please contact our customer service team with your order number, the item(s) returned, and a scan or photo of your posting receipt so we can investigate. _(counts from delivery)_
  - > We aim to process and refund online orders within 14 days of you returning the items. _(online)_
  - > We aim to process and refund online orders within 14 working days of you returning the items. _(online)_

## Jigsaw

- https://www.jigsaw-online.com/pages/delivery-and-returns — “Delivery and Returns | Jigsaw” — HTTP 200
  - > Once your return reaches our warehouse, refunds are processed within 10 working days (excluding weekends and Bank Holidays).
  - > If 8 days have passed since delivery to our warehouse, or only part of your return has been processed, please contact us and we'll be happy to help. _(counts from delivery)_
  - > Full Price items must be returned within 28 days of receipt of your order. _(counts from delivery)_
  - > Sale items can be returned within 14 days from the day of purchase, provided you return them in an unused condition, together with proof of purchase. _(counts from purchase)_

## Ted Baker

- https://www.tedbaker.com/pages/shipping-returns — “Shipping & Returns” — HTTP 200
  - > Note - You have 28 days to return online orders. _(online)_
  - > You have 28 days from the date of purchase to return it for a refund online. _(online, counts from purchase)_
  - > If you’re unable to return it within the 28-day period, please let us know within that timeframe.
  - > Refunds will be made onto your original payment method (within 14 days of us receiving the return). _(counts from delivery)_
- https://www.tedbaker.com/en-gb/pages/shipping-returns — “Shipping & Returns” — HTTP 200
  - > Note - You have 28 days from date of delivery to return online orders. _(online, counts from delivery)_
  - > You have 28 days from the date of delivery to return it for a refund online. _(online, counts from delivery)_
  - > If you’re unable to return it within the 28-day period, please let us know within that timeframe.
  - > Refunds will be made onto your original payment method (within 14 days of us receiving the return). _(counts from delivery)_

## Boden

- https://www.boden.com/pages/returns-and-refunds — “Returns and refunds | Boden UK” — HTTP 200
  - > Please allow up to 14 days for your returned parcel to reach us.
  - > If you return an item within 30-days of receipt in its original condition, we’ll refund the amount you paid for the item.
  - > For sale items, you have 14 days to notify us of the return by registering the return with our online returns partner. _(online)_
  - > After notifying us of this return, you have another 14 days to return your items, in its original condition.
  - > After our standard 30-day return period, or 14 days for sale items, you can return anything that does not meet our quality standards up until one year after your order arrived for account credit.
  - > Within 6 months – we’ll refund your item and you're welcome to place a new order (subject to availability).
  - > Returned parcels can take up to 14 days to reach us from the date they’re sent back.
  - > Any refund will appear in your account within 5 working days from the date it was processed.
  - > If you don’t hear from us within 14 days of sending your items back, please contact us with your order number and the details about which items you returned.
  - > Returns can take up to 14 days to be completed, and we’ll send an email as soon as we’ve processed your item(s).
  - > Try on and return pieces for free within 7 days.
- https://www.boden.com/policies/refund-policy — “Refund policy | Boden UK” — HTTP 200
  - > If you return an item in its original condition within 30-days of receipt, or 14-days for sale items, we’ll give you back the amount you paid for the item.
  - > Any returns received after 30 days of receipt (or 14 days for sale items) will be refunded as account credit for use on a future order. _(counts from delivery)_
  - > Please allow up to 14 days for your refund to be completed.
  - > Returned parcels can take up to 14 days to reach us from the date they’re sent back.
  - > Any refund will appear in your account within 5 working days from the date it was processed.
  - > If you don’t hear from us within 14 days of sending your items back, please contact us with your order number and the details about which items you returned.
  - > Try on and return pieces for free within 7 days.

## Sweaty Betty

- https://www.sweatybetty.com/ — “Sweaty Betty London | Womens Activewear | Run & Yoga Clothes” — HTTP 200
  - > Looking for workout wear for different activities? Discover why almost 20,000 women rate our Power legging 5* and why our Explorer range is your crease-free collection for when you’re on the go with 45-day free returns across 150 countries. _(counts from delivery)_
- https://www.sweatybetty.com/delivery-returns.html — “Delivery + Returns” — **unreadable: blocked by the site**
- https://help.sweatybetty.com/kb/en/returns — **unreadable: HTTP 502**

## Gymshark

- https://support.gymshark.com/en/articles/5227025-returns-policy — “Returns Policy | Gymshark Support” — HTTP 200
  - > As long as your item(s) were either purchased from gymshark.com or our Gymshark App, and are still in their original condition, you have up to 30 days to return your item back to us! _(counts from purchase)_
  - > Any unwanted product must be returned within 30 days from when your Gymshark order was delivered (if the order was placed online) or was purchased (if you bought the items in one of our stores). _(counts from delivery)_
  - > Refunds can take up to 7 days for your refund to appear in your account once processed.
  - > A refund can take up to 7 working days to be processed and returned to your account.
- https://support.gymshark.com/en/articles/12829778-how-do-i-return-my-order — “How Do I Return My Order? | Gymshark Support” — HTTP 200
  - > 📦 You have 30 days from delivery to start your return. _(counts from delivery)_
  - > Your refund will then be issued within a further 7 working days.
  - > After your return is processed, please allow up to 7 working days for the refund to clear with your bank.
  - > Allow up to 8 working days from the time you drop off your return for it to be processed.

## Oliver Bonas

- https://www.oliverbonas.com/returns-and-refunds — “Returns & Refunds | Oliver Bonas” — HTTP 200
  - > We hope you’re happy with your Oliver Bonas purchase, but if you decide it’s not quite right for you, you can return most items to us within 30 days of purchase or receiving your order, whichever is later. _(counts from delivery)_
  - > Depending on your return method it can take 3-5 working days for your order to arrive back to us.
  - > Once processed your refund will then be credited within a further 3-5 working days depending on your bank or payment method.
  - > 3-5 working days for parcels to arrive back to us and be processed then 3-5 working days for your refund to appear in your account.
  - > If you have any issues or if your return is outside of our 30-day period, please contact our Customer Service Team
  - > Our quickest returns method for online orders, items are processed straight away in store (excludes PayPal orders) and your refund will appear in your account within 3-5 working days.
  - > Proof of purchase is required, returns within 30 days. _(counts from purchase)_
  - > Our quickest returns method for in store purchases, items are processed straight away and your refund will appear in your account within 3-5 working days. _(in store)_
  - > Proof of purchase required, returns within 30 days. _(counts from purchase)_
  - > It takes 3-5 working days for parcels to arrive back to us and then 3-5 working days for your Gift Card refund to be emailed to you.
  - > Products purchased in our OB Outlet store must be returned to the same store within 14 days of purchase. _(counts from purchase)_
  - > International returns take 10–20 working days

## Kurt Geiger

- https://help.kurtgeiger.com/hc/en-gb/articles/360017099780-What-Is-Your-Online-Returns-Policy — “What Is Your Online Returns Policy? – Kurt Geiger” — HTTP 200
  - > We want you to love your purchase, but if something’s not quite right, you can return full-price unworn items from your www.kurtgeiger.com order within 30 days of purchase for a full refund to your original payment method. _(counts from purchase)_
  - > Unworn, unused sale items can be returned within 14 days of purchase for a full refund. _(counts from purchase)_
  - > Your refund will be processed within 14 working days from the date we receive your parcel, and we’ll keep you updated with email notifications once your refund has been received and processed. _(counts from delivery)_
- https://help.kurtgeiger.com/hc/en-gb/articles/360018868560-What-Is-Your-In-Store-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**

## Dune London

- https://www.dunelondon.com/customer-service/returns.html — “Dune London Returns” — HTTP 200
  - > You can return your purchase within 28 days for a refund, provided it meets the terms and conditions outlined on this page. _(counts from purchase)_
  - > Items returned to a store will be refunded within 5 working days.
  - > Items returned to our warehouse will be refunded within 10 working days of receiving your parcel. _(counts from delivery)_
  - > Credit and Debit payment refunds should appear in your account within 5 working days.
  - > We will process your refund within 10 days of receiving your returned items. _(counts from delivery)_
  - > In the case that a return has been rejected, we will contact you within 10 days.
- https://help.dunelondon.com/support/solutions/articles/75000007768-how-can-i-return-my-order- — “How can I return my order? : Dune London” — HTTP 200
  - > You will receive your refund within 10 working days of the item(s) being sent back. _(counts from delivery)_

## Moss

- https://www.moss.co.uk/returns-policy — “Returns & Refunds | How to return | Buy Online at Moss” — HTTP 200
  - > If you need to return any items that were bought online, you have 14 days after receipt of your order to notify us, unless your order is covered by our extended Christmas returns policy. _(online, counts from delivery)_
  - > The easiest and most convenient way to return is to visit your nearest Moss store within 14 days of receipt of your order. _(counts from delivery)_
  - > Please visit our returns portal at https://returns.moss.co.uk within 14 days of receipt of your order and follow the instructions. _(counts from delivery)_
  - > After you have requested a return or exchange in the returns portal, you have a further 14 days to return the goods to us.
  - > If you need to exchange your items for a different size, please notify us within 14 days of receipt of your order. _(counts from delivery)_
  - > If you return your items using Collect+ or Royal Mail, it can take up to 7 days to receive them back to our processing centre. _(counts from delivery)_
  - > It can take up to a further 7 days to inspect and process your return.
  - > It can then take up to 7 days for the refund to appear back onto your payment card or into your account, depending on your bank or payment provider.

## Charles Tyrwhitt

- https://www.charlestyrwhitt.com/uk/terms-and-conditions-wrapper.html — “Terms and Conditions | Charles Tyrwhitt” — HTTP 200
  - > 4.1 If you are contracting as a consumer, you may cancel a Contract at any time within 14 days, beginning on the day after you received the Products. _(counts from delivery)_
  - > 8.1 Products purchased via the Charles Tyrwhitt Website can be returned to us for a full refund or exchange within 6 months of the date of dispatch. _(counts from dispatch)_
  - > (a) because you have cancelled the Contract between us within the 6 month period above and provided proof of purchase (receipt, confirmation email or order number) we will process the refund due to you as soon as possible and, in any case, within 30 days of the day you have given notice of your cancellation. _(counts from purchase)_
  - > We will usually process the refund due to you as soon as possible and, in any case, within 30 days of the day we confirmed to you via email that you were entitled to a refund for the defective Product.

## Crew Clothing

- https://www.crewclothing.co.uk/returns/ — “Returns” — HTTP 200
  - > You can return your purchase within 28 days or 14 days if you've purchased a sale item, as long as it’s in its original condition with tags attached, and you have your order details or proof of purchase. _(counts from purchase)_
  - > Sale items can be returned up to 14 days after purchase, and any items returned without a receipt can be exchanged in store at the current selling price. _(in store, counts from purchase)_
  - > You will receive your refund in your bank 3-5 days after the refund is processed. _(counts from delivery)_
  - > Refunds will be processed within 7 working days of us receiving them, although this may take a little longer during particularly busy sale periods. _(counts from delivery)_
  - > Return through EVRi’s store network of over 7,000 ParcelShops, open 7 days a week, early until late
- https://help.crewclothing.co.uk/hc/en-gb/articles/360020960079-How-long-do-I-have-to-return-an-item — “Just a moment...” — **unreadable: blocked by the site**

## Peacocks

- https://www.peacocks.co.uk/returns-and-exchange.html — “Returns & Refunds | Peacocks” — HTTP 200
  - > If you are not satisfied with your purchase, we will be happy to give you a full refund for goods returned within 28 days of you receiving your order _(counts from delivery)_
  - > Upon receipt of your items, your return will be processed within 7 days and we'll refund the card you paid with. _(counts from delivery)_
  - > Upon receipt of your items, your return will be processed within 7 days and we’ll refund the card you paid with. _(counts from delivery)_
  - > Your refund will be processed onto the original payment method used by the store colleague and you can expect to receive your refund usually, within 3-5 working days. _(counts from delivery)_
  - > If you are not satisfied with your purchase, we will be happy to offer an exchange or refund, if you return your item(s) to us in their original condition with a valid till receipt within 28 days of the original purchase date. _(counts from purchase)_
  - > Once your item(s) have been received by our warehouse, a refund will be processed back onto your payment method with 7 working days. _(counts from delivery)_
  - > If you have not received the refund within 7 days or you have any queries, please reach out through our Contact Us page or by phone on 0330 124 2184 (Monday-Sunday 8:00am - 8:00pm). _(counts from delivery)_
  - > to your local Peacocks store, the refund will be processed whilst you are at the store and should drop back onto your payment card within 3-5 working days. _(in store)_

## Iceland

- https://www.iceland.co.uk/terms.html — “Terms & Conditions - Help & Support | Iceland Foods” — HTTP 200
  - > You will be refunded the difference if the full cost of your order on the date of delivery is less than the Original Order value however, the refund may take up to 5 working days to appear depending on your card issuer. _(counts from delivery)_
  - > Any refunds or additional payments will be processed on the date of your delivery however, they may take up to 5 working days to appear depending on your card issuer. _(counts from delivery)_
  - > 7.2 Cancelling your order: You also have a legal right to cancel an order at any time up to 14 working days (not including Saturdays, Sundays or public holidays) from the day after the day the products are delivered to you. _(online, counts from delivery)_
  - > The money will be refunded to your account as soon as possible and, in any case, within 14 calendar days of notification of cancellation.
  - > We will process any agreed refunds as soon as possible which in relation to goods you have already received will be within 14 calendar days of the date upon which we receive the returned goods from you, or where goods you claim to have returned have not been received by us, within 14 calendar days from the date upon which you provide to our reasonable satisfaction proof that substantiates you having taken the necessary measures to return the goods to us, whichever date is the sooner. _(counts from delivery)_
  - > Once the online form has been completed, we will process the refund as soon as possible and, in any case, within 14 calendar days after the day on which we receive the products back, or 14 days after the day on which you gave us the evidence of having sent the products back, whichever is sooner. _(online, counts from delivery)_

## Ocado

- https://www.ocado.com/ — “Online Food Shopping & Grocery Delivery | Ocado” — HTTP 202
- https://help.ocadoretail.com/ — “Home” — HTTP 202

## Co-op

- https://www.coop.co.uk/ — **unreadable: blocked by the site**
- https://www.coop.co.uk/terms/delivery-click-and-collect-and-home-delivery-terms-and-conditions — **unreadable: blocked by the site**

## Cult Beauty

- https://www.cultbeauty.co.uk/c/info/refunds-returns/ — “Refunds & Returns | Cult Beauty” — HTTP 200
  - > This can take 3-5 working days from the date we receive the return. _(counts from delivery)_
  - > *Please note that in order for a return to be eligible, it must be in pristine condition and raised within 30 days of receipt.
  - > We are happy to offer a refund/exchange for an unwanted item returned within 30 days of receipt.
  - > Please be aware that we must receive returns within 30 days of delivery – this is irrespective of your chosen payment method. _(counts from delivery)_
  - > You should then receive your refund (via Klarna) within 5-10 working days to your chosen account.If you have any questions regarding your Klarna account, you can contact Klarna’s Customer Service team directly. _(counts from delivery)_

## Charlotte Tilbury

- https://www.charlottetilbury.com/uk/help/returns — “Returns & Exchanges | Charlotte Tilbury” — HTTP 200
  - > We are able to accept the return of unused or gently used items free of charge for a full refund within 30 days of you receiving your purchase. _(counts from delivery)_
  - > You are entitled to a full refund or replacement for damaged or faulty product(s) within 31 days of receiving your purchase. _(counts from delivery)_
  - > If you return a faulty product within 6 months of receiving your purchase, you are entitled to a replacement product (if no replacement product is available, we will process a refund for you). _(counts from delivery)_
  - > We will aim to refund you within 14 days of receiving the returned item. _(counts from delivery)_
  - > UK residents may exchange like for like items within 30 days from the date they received their item. _(counts from delivery)_
  - > If you are a customer resident in the UK or a member state of the European Union, Iceland, Liechtenstein, or Norway ("EEA"), you have a “cooling-off” right to cancel your online order for any reason within 14 days of receiving your purchase and to receive a full refund. _(online, counts from delivery)_

## Pandora

- https://uk.pandora.net/en/ — “Just a moment...” — **unreadable: blocked by the site**
- https://help.pandora.net/uk/login?ec=302&startURL=%2Fuk%2Fs%2Farticle%2FHow-do-I-return-my-order — “Login | Pandora Services Knowledge Base UK” — HTTP 200
- https://uk.pandora.net/en/tandcs/terms-and-conditions.html — “Just a moment...” — **unreadable: blocked by the site**

## Ernest Jones

- https://www.ernestjones.co.uk/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.ernestjones.co.uk/refunds — “Access Denied” — **unreadable: blocked by the site**

## H.Samuel

- https://www.hsamuel.co.uk/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.hsamuel.co.uk/returns — “Access Denied” — **unreadable: blocked by the site**

## Goldsmiths

- https://www.goldsmiths.co.uk/i/returns-policy — “Returns Information | Goldsmiths” — HTTP 200
  - > You have the right to cancel your purchase by notifying us at any time up to 14 days from the day after the item was delivered to you. _(online, counts from delivery)_
  - > You then have a further 14 days from the date of cancellation to return the item to us.
  - > Cancellation Rights: If you change your mind about a purchase you have made through our website or by phone or via a device in-store or through our PayByLink, you have the right to cancel the purchase by notifying us at any time up to 14 days from the day after the item was delivered to you and further 14 days from then to return the item to us. _(counts from delivery)_
  - > We are also happy to exchange your item within 14 days from the date of despatch.
  - > If we are unable to make contact with you within 14 days of receiving your item(s), we will return it to the delivery address linked to the order. _(counts from delivery)_
  - > It can take up to 14 days for us to process your return.
  - > Within 30 days of purchase/delivery you have the right to a refund. _(counts from delivery)_

## Beaverbrooks

- https://www.beaverbrooks.co.uk/info/returns — “Returns Policy | Beaverbrooks the Jewellers” — HTTP 200
  - > Just make sure that the product is in its original packaging and accompanied by proof of purchase (receipt or despatch invoice) and return the unworn item to us via post or in-store within 30 days. _(in store, counts from purchase)_
  - > If you return your item via post, please allow 7-10 working days for a refund or exchange to be received. _(counts from delivery)_
  - > We will be happy to refund or exchange your item providing it is returned in the same condition that it was in when purchased and is in its original packaging, along with all relevant paperwork and accompanied by proof of purchase within 14 days of purchase. _(counts from purchase)_
- https://www.beaverbrooks.co.uk/help/returning-an-item — “Returning An Item | Beaverbrooks the Jewellers” — HTTP 200
  - > We’re confident you’ll love your purchase but just in case it’s not quite perfect for you, you can return your unworn item within 30 days via post or your nearest store. _(counts from purchase)_
  - > We will be happy to offer a refund or exchange on earrings providing they are unworn, within 30 days of purchase and you have your proof of purchase and original packaging. _(counts from purchase)_
  - > We will be happy to accept a return on one of our pre-owned watches within 14 days of purchase, providing you have your proof of purchase and any papers and packaging. _(counts from purchase)_
  - > Please allow 10 days for our team to process your return.
  - > Your refund will show back in your account within 3-5 working days from being processed.
  - > If you haven’t received your refund after the end of 5 working days, please contact us on 0800 169 2329 and the team will be happy to help. _(counts from delivery)_
  - > Yes, providing the item is returned within 30 days unworn and in its original packaging, accompanied by proof of purchase (receipt or despatch invoice). _(counts from purchase)_

## Hotel Chocolat

- https://www.hotelchocolat.com/uk/help/our-guarantee.html — “100% Happiness Guarantee | Hotel Chocolat” — HTTP 200
- https://www.hotelchocolat.com/uk/i/terms-and-conditions.html — “Terms & Conditions | Hotel Chocolat” — HTTP 200
  - > If We have taken payment any such sums will be refunded to you as soon as possible and in any event within 14 days.
  - > 10.3 In the unlikely event that We fail to deliver the Goods within 30 calendar days of Our dispatch confirmation (unless otherwise agreed as under sub-Clause 10.1), if any of the following apply you may cancel your Order immediately: _(counts from dispatch)_
  - > 11.2 Beginning on the day that you receive the Goods you have a 30 Calendar Day right to reject the Goods and to receive a full refund if they do not conform as stated above. _(counts from delivery)_
  - > If you exercise the final right to reject the goods more than six months after you have received the Goods (and ownership of them), We may reduce any refund to reflect the use that you have had out of the Goods. _(counts from delivery)_
  - > If you are a consumer in the European Union you have a legal right to a 14 calendar day cooling off period within which you can return Goods for this reason.
  - > 11.5 Refunds (whether full or partial, including reductions in price) under this Clause 11 will be issued within 14 Calendar Days of the day on which We agree that you are entitled to the refund.
  - > 12.5 Please ensure that you return Goods to Us no more than 14 calendar days after the day on which you have informed Us that you wish to cancel under this Clause 12.
  - > 12.7 Refunds under this Clause 12 will be issued to you within 14 calendar days of the following:
  - > 14.2.4 If the event outside of Our control continues for more than 28 days We will cancel the Contract and inform you of the cancellation.
  - > Any refunds due to you as a result of that cancellation will be paid to you as soon as is reasonably possible and in any event within 14 days of the date on which the Contract is cancelled;
  - > 14.2.5 If an event outside of Our control occurs and continues for more than 28 days and you wish to cancel the Contract as a result, you may do so.
  - > Any refunds due to you as a result of such cancellation will be paid to you as soon as is reasonably possible and in any event within 14 days of the date on which the Contract is cancelled.
  - > If you do opt to cancel, you must return any affected Goods you have already received and we will arrange for a full refund (including delivery charges) which will be paid within 14 days of your cancellation. _(counts from delivery)_

## LEGO

- https://www.lego.com/en-gb/page/returns?age-gate=grown_up — “LEGO® Returns | Official LEGO® Shop GB” — HTTP 200
  - > 35 days to make a return
- https://www.lego.com/en-gb/service/help-topics/article/returning-a-legocom-order?age-gate=grown_up — “Help Topics” — HTTP 200
  - > If you’re not completely satisfied with your order, you can return it to us FREE of charge within 35 days from the day you receive your parcel. _(counts from delivery)_
  - > We’ll start processing your refund within 1-2 days after we get the items back.

## Disney Store

- https://www.disneystore.co.uk/ — “Disney Store UK | Discover and Buy Official Merchandise” — HTTP 200
- https://support.disneystore.co.uk/hc/en-gb/articles/20170021665171-General-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**
- https://sso.myid.disney.com/app/disney_dcpunifiedretailzendeskproduction_1/exk1dgudnneJMEgeg0x8/sso/saml?RelayState=https%3A%2F%2Fsupport.disneystore.co.uk%2Fhc%2Fen-gb%2Farticles%2F5655881774355-How-long-do-I-have-to-return-an-order-and-how-quickly-will-I-be-refunded&brand_id=5525991886483&SAMLRequest=fZFPT8JAEMXvfopm7223BQrd0JIGYtIEjQH14G27HcLG%2FVN3tgh%2BekOVBA9y%0AnXm%2FvDdv5oujVsEBHEprCpJElCzKuzlyrTpW9X5vNvDRA%2FrgqJVBNiwK0jvD%0ALEeJzHANyLxg2%2BphzdKIss5Zb4VV5Aq5TXBEcF5aQ4J6VZAz4MIkF7PdbJqF%0AQBsajsVoGvImT0IuJs1EZGkzyzMS1Ig91AY9N74gKU2zMKEhHT0nKUtzNqZv%0AJHi9XJdGlATVxWxpDfYa3BbcQQp42awLsve%2BQxbHuLddK9HAKfoC0wK%2BR8Lq%0AmAsBiPE5ICmHktgQwJW3wXl8rf1t95FrqFdPVklxCiql7OfSAfdQEO96IMG9%0AdZr7%2F5tLomSYyDbcDVIGmktVta0DRBKXP65%2F31jefQM%3D%0A — “The Walt Disney Company - Sign In” — HTTP 200

## Build-A-Bear

- https://www.buildabear.co.uk/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.buildabear.co.uk/brand-help-returns.html — “Access Denied” — **unreadable: blocked by the site**

## Foyles

- https://www.foyles.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.foyles.co.uk/help/refunds-returns — “Just a moment...” — **unreadable: blocked by the site**

## Flying Tiger

- https://flyingtiger.com/en-gb/pages/terms-conditions — “Terms and Conditions - Flying Tiger Copenhagen” — HTTP 200
  - > You must return the product(s) or hand over the goods to [Digital Flying Tiger Copenhagen A/S, Strandgade 71 – 73, DK-1401 Copenhagen, Denmark] without delay and in any case no later than 14 days from the day on which you notify us of the withdrawal from this contract.
  - > 9.5 Any refund we owe to you will be made to the original payment method as soon as possible but may take up to 14 days.
- https://flyingtiger.com/en-gb/pages/faq — “Customer Care Contact FAQ | Delivery, Returns, Order Support” — HTTP 200
  - > Return within 14 days: Decide to return the item(s) within 14 days of receiving your delivery. _(counts from delivery)_
  - > If you would like to return whole or part of your order, returns are accepted within 14 days from the date of delivery. _(counts from delivery)_

## Muji

- https://uk.muji.eu/pages/frequently-asked-questions/returns-refunds.html — “Returns & Refunds | MUJI” — HTTP 200
  - > Returns are processed at our warehouse within 15 working days of receipt.
  - > Refunds are issued by MUJI within 2 working days after return confirmation.
  - > Please allow approximately 17 working days from the date your return is received. _(counts from delivery)_
  - > Returns must be registered and initiated within 30 days of receipt of your order. _(counts from delivery)_
  - > Refunds of delivery charges are only available where the entire order is returned within the 14-day cancellation period, or where items are incorrect, damaged, or faulty. _(counts from delivery)_
  - > If you have not received a confirmation email stating “Return Delivered/Completed” within 10 days of dropping off your parcel, please contact us and we will investigate this on your behalf. _(counts from delivery)_
  - > Once your return is received at our warehouse, it may take up to 15 working days to process, and refunds will be issued within 2 working days after confirmation. _(counts from delivery)_
  - > Refunds may take up to 17 working days from the date your return is sent back to us.
  - > Up to 15 working days for the returned parcel to be delivered to our warehouse and processed by our warehouse team. _(counts from delivery)_
  - > Up to an additional 2 working days for MUJI to complete the refund once the return has been processed.

## Foot Locker

- https://www.footlocker.co.uk/en/right-of-withdrawal.html — “right_withdrawal | Foot Locker UK” — HTTP 200
  - > The items need to be returned to us without undue delay and in any event not later than 14 calendar days from the day of your withdrawal communication.
  - > For this reason, Foot Locker offers you, without affecting your statutory withdrawal rights as set out above, an even more convenient right of return by simply accepting any items that you return to us within 28 calendar days after the items are delivered to you, Under our Foot Locker policy no formal statement of withdrawal as required under the statutory withdrawal right is necessary; if you want to withdraw from your purchase, you can do so by simply returning the relevant items within 28 days after delivery. _(online, counts from delivery)_
  - > If you validly cancel and return your order in accordance with the terms set out above and in our Terms & Conditions, we will refund you without undue delay and in any event not later than 14 days from the day on which we received your notice of withdrawal. _(counts from delivery)_
- https://www.footlocker.co.uk/en/terms.html — “Terms | Foot Locker UK” — HTTP 200
  - > You have the legal right to withdraw from your purchase agreement without giving any reason within 14 days after the delivery date, except for item(s) (i) adjusted to your personal specifications, (ii) that are clearly personalized, and/or (iii) which are not suitable for return due to health protection or hygiene reasons. _(counts from delivery)_
  - > You must have dispatched the item(s) for return within 14 days after you notified us of your invocation of the right to withdrawal. _(counts from dispatch)_
  - > Without affecting your legal right of withdrawal, we also offer a contractual extended return period of 28 days from the delivery date. _(counts from delivery)_
  - > If the item(s) have already been shipped or have been delivered to you, you have 28 days, counting from the delivery date, to return the item(s) to us. _(online, counts from dispatch)_
  - > 1. returned in-store or dispatched for return to our warehouse by post later than 28 days after the delivery date; the end of our contractual extended return period; _(counts from dispatch)_
  - > After we have checked the returned item(s) and concluded that the item(s) is/are in original unused condition and are complete, we will provide you with the refund via the same payment method you used to pay for your online purchase within 14 days. _(online, counts from purchase)_
  - > After we have received the item(s) at our warehouse, checked the returned item(s) and concluded that the item(s) is/are in original unused condition and are complete, we will provide you with the refund within 14 days from the date we receive the item(s) back to our warehouse or the date you provide evidence of having sent back the item(s), whichever is the earliest. _(counts from delivery)_

## Snow+Rock

- https://help.snowandrock.com/hc/en-gb/articles/12594771378450-Returns-Policy — “Returns Policy – Snow+Rock” — HTTP 200
  - > Full-priced products can be returned for refund within 30 days of purchase (100 days for Explore More members). _(counts from purchase)_
  - > For Sale/clearance products, the return must be made within 14 days of purchase. _(counts from purchase)_
  - > For Outlet products, including those purchased in our Outlet stores, returns are limited to 14 days of purchase, and a credit note will be issued to use against a future purchase. _(counts from purchase)_
  - > PPE Climbing equipment and cycling helmets purchased online or by phone and delivered to your address can only be returned within 14 days of receipt. _(online, counts from delivery)_
  - > Customers have the right to cancel their order within 14 days of receiving their goods, as per the Consumer Contracts Regulations 2013. _(counts from delivery)_
  - > For online purchases not collected in-store, these can be returned within 14 days of receipt. _(counts from delivery)_
  - > You have the right to cancel your order within 14 days of receipt of the products. _(counts from delivery)_
- https://help.snowandrock.com/auth/v3/signin?brand_id=745769&locale=en-gb&return_to=https%3A%2F%2Fhelp.snowandrock.com%2Fhc%2Fen-gb%2Farticles%2F360001576380-Our-refund-policy&role=end_user — “Sign in to Snow + Rock” — HTTP 200

## Ellis Brigham

- https://www.ellis-brigham.com/information/delivery-returns — “Delivery & Returns” — HTTP 200
  - > If you're unhappy with your purchase and it's in a new and unused condition, you can return it within 30 days of receiving your order. _(counts from delivery)_
  - > Once we receive your return, please allow up to 5 working days for your refund to be issued. _(counts from delivery)_

## Blacks

- https://www.blacks.co.uk/policies/refund-policy — “Returns and Refunds – Blacks” — HTTP 200
  - > You can also return online orders, as well as items bought in store to any of stores within 28 days. _(counts from purchase)_
  - > You have 14 days from delivery (rather than the normal 28) to return any refurbished item you purchase online. _(online, counts from delivery)_
  - > Beyond 14 days, we will only accept returns for faulty goods.
  - > Whatever your reason, we offer a refund within 28 days of delivery or collection. _(counts from delivery)_
  - > Return your parcel within 30 days of delivery (Christmas orders may have an extended returns window). _(counts from delivery)_
- https://www.blacks.co.uk/pages/customer-care/returns — “Returns – Blacks” — HTTP 200
  - > You have 28 days to return your order to us, from the date you receive your order. _(counts from delivery)_
  - > If you used our Returns Portal, we expect the carrier to have returned your order to us within 10 days of you passing your return to them.
  - > Once the parcel has arrived with our returns team, we aim to process it within 14 days.
  - > Once the refund process has started, we expect the refund to be back with you within 5 working days.
  - > Once the cancellation has been confirmed and the refund process started, we expect the refund to be with you within 5 working days.

## Millets

- https://www.millets.co.uk/policies/refund-policy — “Returns and Refunds – Millets” — HTTP 200
  - > If you wish to return a purchase made in store or online this can be done at any of our stores within 28 days. _(counts from purchase)_
  - > Whatever your reason, we offer a refund within 28 days of delivery or collection. _(counts from delivery)_
  - > If an entire order is cancelled within the 14 day cancellation period then the standard delivery charge will be refunded. _(counts from delivery)_
  - > You have 14 days from delivery (rather than the normal 28) to return any refurbished item you purchase online. _(online, counts from delivery)_
  - > Beyond 14 days, we will only accept returns for faulty goods.
- https://www.millets.co.uk/pages/customer-care/returns — “Returns – Millets” — HTTP 200
  - > If you used our Returns Portal, we expect the carrier to have returned your order to us within 10 days of you passing your return to them.
  - > Once the parcel has arrived with our returns team, we aim to process it within 14 days.
  - > Once the refund process has started, we expect the refund to be back with you within 5 working days.
  - > Once the cancellation has been confirmed and the refund process started, we expect the refund to be with you within 5 working days.
  - > You have 28 days to return your order to us, from the date you receive your order. _(counts from delivery)_

## Trespass

- https://www.trespass.com/help/returns-and-refunds — “Returns & Refunds” — HTTP 200
  - > We hope you love your new purchase, however, if for any reason you need to return an item, you can within 21 days of the original delivery date. _(counts from delivery)_
  - > When approved, we will refund the order to the original payment method, please allow 10 working days for this to be credited.
  - > You can return any item for a refund within 21 days of receiving your original order. _(counts from delivery)_
  - > You can return any unwanted items to your local Trespass store within 21 days of the original purchase, providing that they are in the condition you received them in, with all tags attached. _(counts from delivery)_
  - > It can usually take up to 10 working days (excluding weekends and bank holidays) from the date of your return for your parcel to be delivered back to our warehouse and processed. _(counts from delivery)_
  - > This is usually within 1 day of your return being received in our warehouse. _(counts from delivery)_
  - > If your return has not reached us after 10 working days, please track your items to see their status.

## Regatta

- https://www.regatta.com/customer-service-hub/returns-refunds/returns-policy/ — “Returns Policy | Regatta” — HTTP 200
  - > You can return any unworn items (in their original condition) within 30 days of receiving your order for a full refund. _(counts from delivery)_
  - > The refund will be issued to your original payment method within 14 days of being dropped off or posted and we will send you an email once it has processed.
  - > You can return or exchange unwanted items up to 30 days after purchase. _(counts from purchase)_
  - > For purchases made in store, please return to any of our stores with your receipt or proof of purchase within 30 days. _(in store, counts from purchase)_

## Rohan

- https://www.rohan.co.uk/ — HTTP 200
- https://www.rohan.co.uk/help/returns/ — HTTP 200

## Evans Cycles

- https://www.evanscycles.com/ — **unreadable: HTTP 502**
- https://www.evanscycles.com/help/returns-and-refunds — **unreadable: HTTP 502**

## Jollyes

- https://www.jollyes.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.jollyes.co.uk/i/returns-and-refunds — “Just a moment...” — **unreadable: blocked by the site**

## Bensons for Beds

- https://help.bensonsforbeds.co.uk/support/solutions/articles/80000856319-can-i-exchange-my-goods-after-they-have-been-delivered- — “Can I return or exchange after delivery? : Bensons For Beds” — HTTP 200
  - > If you purchased online or via the telephone you can return or exchange your goods after they have been delivered within 14 days. _(online, counts from delivery)_
- https://www.bensonsforbeds.co.uk/terms-and-conditions/ — “Vercel Security Checkpoint” — **unreadable: blocked by the site**

## Dreams

- https://www.dreams.co.uk/help/returns-and-refunds-services — “Returns And Refunds” — HTTP 200
  - > Online orders will be refunded within 14 days of _(online)_
  - > We’ll make sure to refund you within 14 days
  - > You have 14 days from your delivery date to return any unused and unopened bedding items in their original packaging. _(counts from delivery)_
  - > If you picked up your bedding from a Dreams store, you can return it within 14 days as long as the items are unused and unopened in their original packaging.
- https://www.dreams.co.uk/help/returns-and-refunds — “Returns & Refunds FAQs” — HTTP 200

## Loaf

- https://loaf.com/ — “Just a moment...” — **unreadable: blocked by the site**
- https://loaf.com/helphub/returns — “Just a moment...” — **unreadable: blocked by the site**
- https://loaf.com/returns-and-exchanges — “Just a moment...” — **unreadable: blocked by the site**

## Sofology

- https://help.sofology.co.uk/hc/en-us/articles/19236830172434-Can-I-cancel-my-order — “Just a moment...” — **unreadable: blocked by the site**
- https://www.sofology.co.uk/terms-and-conditions — “Terms & Conditions | Sofology” — HTTP 200
  - > If we are unable to contact you, or if no response is received within 7 days, your order will be treated as cancelled, and a full refund will be issued. _(counts from delivery)_
  - > Refunds are typically processed within 14 days using the same payment method as the original transaction.
  - > 13.8 From the day of collection, your refund will be processed within 14 calendar days. _(counts from delivery)_
  - > Within the 14 days, we will inspect and ensure the goods have been returned in good quality.
  - > We can start the refund process, however, for example, if you have bought on finance, the funds may not be received by you within the 14 days, but we will process the refund by day 14. _(counts from delivery)_
  - > If a fault or damage is discovered up to 30 days after delivery, please contact us as soon as you notice the defect so we can review and discuss the options available, which include: a repair; a refund; a replacement. _(counts from delivery)_

## ScS

- https://www.scs.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.scs.co.uk/help/terms-and-conditions/telephone-sales-terms-and-conditions.html — “Just a moment...” — **unreadable: blocked by the site**
- https://www.scs.co.uk/help/before-you-buy/faqs/aftersales-faqs.html — “Just a moment...” — **unreadable: blocked by the site**

## Barker and Stonehouse

- https://www.barkerandstonehouse.co.uk/returns — “Returns Information - Barker and Stonehouse” — HTTP 200
  - > Your cancellation must be sent to us within these 14 days by completing the form below or by post to Barker and Stonehouse Haydock Park Road, Teesside Retail Park, Stockton-on-Tees, TS17 7BG. _(online)_
  - > If after receiving your item/s, you wish to return it/them, you must notify us in writing within 14 days of receiving your item/s. _(counts from delivery)_
  - > Once you have notified us within this 14-day period, you will then have a further 14 days to return the item/s to us.
  - > Once we have received your item/s back we will process the refund within 14 days. _(counts from delivery)_

## Mamas & Papas

- https://www.mamasandpapas.com/pages/delivery-and-collection-information — “Delivery And Collection Information – Mamas & Papas UK” — HTTP 200
  - > If for any reason you are not satisfied, we offer a 30-calendar day returns policy.

## Littlewoods

- https://www.littlewoods.com/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.littlewoods.com/delivery-options.page — “Access Denied” — **unreadable: blocked by the site**

## JD Williams

- https://support.jdwilliams.co.uk/hc/en-gb/articles/360002165150-What-is-your-return-policy — “What is your return policy? – JD Williams” — HTTP 200
  - > 28 day return period
  - > We hope you love your order, but if not, you can return it back to our warehouse within 28 days of delivery. _(counts from delivery)_
  - > If your items arrive back with us within the 28 day period we’ll process a full refund back to your original payment method.
  - > Once received, we will let you know and process your refund within 5 working days for card transactions and straight away for credit accounts. _(counts from delivery)_
  - > We do not accept returns outside of the 28 day period.
  - > If you return any items outside of the 28 day period we may:
  - > If your order was made less than 28 days ago and doesn't fall under our returns exceptions, you can go to 'My Account', select 'Orders & Returns', then choose 'View order & return'.
- https://support.jdwilliams.co.uk/hc/en-gb/articles/360002165130-How-long-do-I-have-to-return-my-order — “Just a moment...” — **unreadable: blocked by the site**

## Simply Be

- https://www.simplybe.co.uk/ — “Simply Be - Down For Maintenance” — **unreadable: blocked by the site**
- https://support.simplybe.co.uk/hc/en-gb/articles/360011852400-What-is-your-return-policy — “Just a moment...” — **unreadable: blocked by the site**
- https://support.simplybe.co.uk/hc/en-gb/articles/360002530644-How-long-do-I-have-to-return-my-order — “Just a moment...” — **unreadable: blocked by the site**

## Jacamo

- https://support.jacamo.co.uk/hc/en-gb/articles/360002530584-What-is-your-return-policy — “What is your return policy? – Jacamo” — HTTP 200
  - > 28 day return period
  - > We hope you love your order, but if not, you can return it back to our warehouse within 28 days of delivery. _(counts from delivery)_
  - > If your items arrive back with us within the 28 day period we’ll process a full refund back to your original payment method.
  - > Once received, we will let you know and process your refund within 5 working days for card transactions and straight away for credit accounts. _(counts from delivery)_
  - > We do not accept returns outside of the 28 day period.
  - > If you return any items outside of the 28 day period we may:
  - > If your order was made less than 28 days ago and doesn't fall under our returns exceptions, you can go to 'My Account', select 'Orders & Returns', then choose 'View order & return'.
- https://support.jacamo.co.uk/hc/en-gb/articles/360002530564-How-long-do-I-have-to-return-my-order-and-what-happens-if-I-return-it-late- — “Just a moment...” — **unreadable: blocked by the site**

## Freemans

- https://www.freemans.com/web/main/help.asp?cid=71 — “Freemans - Help” — HTTP 200
  - > Our return period – currently extended to 60 days
  - > To make things easier during this time, we have extended our return period to 60 days for purchases made after 16th March.
  - > Should you decide to return your goods, unused and in the original packaging, you will be able to obtain a full refund of for items purchased up to 60 days. _(counts from purchase)_
  - > Any refunds will be credited to your account or the payment method used for the purchase within 3-5 days of receipt. _(counts from purchase)_
  - > You can return items for FREE within 28 days of delivery for a full refund. _(counts from delivery)_
  - > If you're not happy with your purchase, please arrange your return within 14 days of delivery to ensure it satisfies our returns policy. _(counts from delivery)_
  - > Refunds typically appear within 10 days of your return drop off or collection, there is no need to contact us before this time. _(counts from delivery)_
  - > You should receive your refund/credit within 10 days of returning an item to us. _(counts from delivery)_
  - > Our 14 Day Approval Period still applies, so you may return them if they are not suitable.
  - > If you need to arrange a return within the 14 day approval period, for larger items you may not be able to arrange a collection via ‘My Account’. _(counts from delivery)_
  - > With over 4,500 nationwide ParcelShops, open from early until late, 7 days a week it has never been easier to return unwanted items.
  - > We will process your refund as quickly as possible, normally within 7 - 10 days of collection. _(counts from delivery)_
  - > If you have not been credited for any items that you have returned to us, you must inform us within 60 days of collection, otherwise the claim will be invalid. _(counts from delivery)_
  - > Under UK law (Consumer Contracts Regulations 2013), you have the right to cancel most online orders within 14 days of receiving your goods, without giving a reason. _(online, counts from delivery)_
  - > If your order is sent in multiple deliveries, the cancellation period ends 14 days after you receive the final item. _(counts from delivery)_
  - > To cancel your order, you must contact us before the end of the 14-day period.
  - > After you tell us you wish to cancel, you then have a further 14 days to return the goods.
  - > Within 14 days of receiving proof of return — whichever comes first _(counts from delivery)_
  - > If you return items to us after the expiry of the 14 Day Approval Period and / or in an unacceptable condition we may not refund your account.
  - > For every item returned outside of our 14 day Approval Period, an administration charge of £4.95 will be made.
  - > Most returns are refunded back to your credit account or the card you made payment with within 7 - 10 days of being collected. _(counts from delivery)_
  - > If for any reason you have not been credited for any of your returned items you must inform us within 60 days of collection, otherwise the claim will be invalid. _(counts from delivery)_
  - > The cancellation period will expire 14 days after the goods are received by you or by a third party nominated by you to receive the goods. _(counts from delivery)_
  - > If your order is for multiple products for separate delivery, the cancellation period will end 14 days after receipt of the last item. _(counts from delivery)_
  - > Where the goods have not been delivered, the reimbursement will be made within 14 days of the cancellation. _(counts from delivery)_
- https://www.freemans.com/web/main/help.asp?qid=2955 — “Freemans - Help” — HTTP 200
  - > Our return period – currently extended to 60 days
  - > To make things easier during this time, we have extended our return period to 60 days for purchases made after 16th March.
  - > Should you decide to return your goods, unused and in the original packaging, you will be able to obtain a full refund of for items purchased up to 60 days. _(counts from purchase)_
  - > Any refunds will be credited to your account or the payment method used for the purchase within 3-5 days of receipt. _(counts from purchase)_
  - > You can return items for FREE within 28 days of delivery for a full refund. _(counts from delivery)_
  - > If you're not happy with your purchase, please arrange your return within 14 days of delivery to ensure it satisfies our returns policy. _(counts from delivery)_
  - > Refunds typically appear within 10 days of your return drop off or collection, there is no need to contact us before this time. _(counts from delivery)_
  - > You should receive your refund/credit within 10 days of returning an item to us. _(counts from delivery)_
  - > Our 14 Day Approval Period still applies, so you may return them if they are not suitable.
  - > If you need to arrange a return within the 14 day approval period, for larger items you may not be able to arrange a collection via ‘My Account’. _(counts from delivery)_
  - > With over 4,500 nationwide ParcelShops, open from early until late, 7 days a week it has never been easier to return unwanted items.
  - > We will process your refund as quickly as possible, normally within 7 - 10 days of collection. _(counts from delivery)_
  - > If you have not been credited for any items that you have returned to us, you must inform us within 60 days of collection, otherwise the claim will be invalid. _(counts from delivery)_
  - > Under UK law (Consumer Contracts Regulations 2013), you have the right to cancel most online orders within 14 days of receiving your goods, without giving a reason. _(online, counts from delivery)_
  - > If your order is sent in multiple deliveries, the cancellation period ends 14 days after you receive the final item. _(counts from delivery)_
  - > To cancel your order, you must contact us before the end of the 14-day period.
  - > After you tell us you wish to cancel, you then have a further 14 days to return the goods.
  - > Within 14 days of receiving proof of return — whichever comes first _(counts from delivery)_
  - > If you return items to us after the expiry of the 14 Day Approval Period and / or in an unacceptable condition we may not refund your account.
  - > For every item returned outside of our 14 day Approval Period, an administration charge of £4.95 will be made.
  - > Most returns are refunded back to your credit account or the card you made payment with within 7 - 10 days of being collected. _(counts from delivery)_
  - > If for any reason you have not been credited for any of your returned items you must inform us within 60 days of collection, otherwise the claim will be invalid. _(counts from delivery)_
  - > The cancellation period will expire 14 days after the goods are received by you or by a third party nominated by you to receive the goods. _(counts from delivery)_
  - > If your order is for multiple products for separate delivery, the cancellation period will end 14 days after receipt of the last item. _(counts from delivery)_
  - > Where the goods have not been delivered, the reimbursement will be made within 14 days of the cancellation. _(counts from delivery)_

## QVC

- https://www.qvcuk.com/ — **unreadable: HTTP 418**
- https://www.qvcuk.com/content/legal-information/return-policy.html — **unreadable: HTTP 418**
- https://www.qvcuk.com/content/how-do-i-return-to-qvc.html — **unreadable: HTTP 418**

## Topps Tiles

- https://www.toppstiles.co.uk/cancellation-returns-refunds-policy — “Cancellation, Returns and Refunds Policy | Topps Tiles” — HTTP 200
  - > 14 DAY CANCELLATION RIGHTS (Consumer, Online) _(online)_
  - > This means that, up until the end of the 14-day period, if you change your mind or decide for any other reason that you do not want to receive or keep the products you ordered, you can tell us, cancel the Purchase Contract, return the products (if received) and receive a refund. _(counts from delivery)_
  - > 30 DAYS RETURN (Consumer, Trader, Online, In store)
  - > Subject to paragraph 1, you can return some products to us within 30 days of receiving them, for a full refund (excluding delivery charges). _(counts from delivery)_
  - > All products can be returned within 30 days, with the exception of powdered adhesive and levelling compound which due to the nature of the product needs to be returned within 7 days in a sellable condition.
  - > This is addition to your statutory rights, for example your 14-day cancellation rights, as applicable.
  - > We aim to process refunds within 10 working days.
  - > you return the product to a Topps Tiles store within 12 months of the day after you received the product (or the last installment if delivered in installments), together with your receipt as proof of purchase; we aim to process refunds within 10 working days.This is addition to your statutory rights, for example your 14-day cancellation rights, as applicable. _(counts from delivery)_
- https://www.toppstiles.co.uk/refunds — “Our Refunds Policy | Topps Tiles” — HTTP 200
  - > You can return products which are unused and in their original packaging within 30 days of receiving your items, for a full refund (excluding delivery charges). _(counts from delivery)_
  - > All products can be returned within 30 days, with the exception of powdered adhesive and levelling compound which due to the nature of the product needs to be returned within 7 days in a sellable condition.
  - > Topps Tiles reserve the right not to refund if the products are deemed as not being in a resell-able condition, if there is no proof of purchase, or if the products are returned after the 30 day period. _(counts from purchase)_
  - > We aim to process all refunds within 10 working days.

## Selco

- https://www.selcobw.com/info/help/product-returns — “Product Returns & Cancellations | Selco” — HTTP 200
  - > Under 28 days: If you don’t want your order, you can either return it to your nearest store with your invoice or use contact us to request a returns form and post the form and the item(s) to us from your local post office.
  - > On cancellation/return, where you have received the Goods, you must return the Goods to us (together with the original packaging) without undue delay and in any event within 14 days after the day of notification to us, (unless we agree in writing that you may dispose of them; in which case please comply with the manufacturer’s instructions before disposing of hazardous Goods). _(counts from delivery)_
  - > Under 28 days: If your item is faulty, we’ll collect it from you free of charge and offer you an exchange or a refund.
  - > There are also some items that are excluded from the 28-day return policy for unwanted items.

## Poundstretcher

- https://poundstretcher.co.uk/pages/faqs — “FAQs | Poundstretcher” — HTTP 200
  - > Please return it to the store within 28 days with your proof of purchase and the store will happily give an exchange or refund. _(counts from purchase)_
  - > Simply return the product in its original condition with proof of purchase within 28 days and we’ll give you a full refund or replacement. _(counts from purchase)_
  - > Refunds made on a Debit or Credit Card may take up to 14 days.

## The Perfume Shop

- https://www.theperfumeshop.com/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.theperfumeshop.com/returns-and-refunds — “Access Denied” — **unreadable: blocked by the site**

## Hollister

- https://www.hollisterco.com/shop/us — “Client Challenge” — HTTP 200
- https://www.hollisterco.com/shop/us/help/online-return-exchange-policy?originalStore=uk — “Client Challenge” — HTTP 200

## Abercrombie & Fitch

- https://www.abercrombie.com/shop/us — “Client Challenge” — HTTP 200
- https://www.abercrombie.com/shop/us/help/online-return-exchange-policy?originalStore=uk — “Client Challenge” — HTTP 200

## Gap

- https://www.gap.co.uk/ — “Gap UK | Gap Womens, Mens, Baby & Kids Clothing” — HTTP 200
- https://www.gap.co.uk/shop/customer-service/changes-returns-and-exchanges-2/gap-onlinereturns.html — “Access Denied” — **unreadable: blocked by the site**
- https://www.gap.co.uk/shop/customer-service/changes-returns-and-exchanges-2/gap-FAQs.html — “Access Denied” — **unreadable: blocked by the site**

## Levi's

- https://levishelp.levi.com/hc/en-gb/articles/360051052933-What-s-your-return-policy — “What’s your return policy? – Levi's ESW” — HTTP 200
  - > We are very happy to accept returns within 28 days from the date of purchase. _(counts from purchase)_
- https://levihelp.levi.com/hc/en-gb/articles/17475742923281-How-can-I-return-exchange-my-Levi-com-order — “Just a moment...” — **unreadable: blocked by the site**

## Jack & Jones

- https://support.jackjones.com/hc/en-gb/articles/10546459671441-Return-Policy — “Return Policy – Home page” — HTTP 200
  - > That’s why we continue to offer a 100-day return policy online. _(online)_
  - > You have 100 days from the date you receive your order to return the items. _(counts from delivery)_

## Pull&Bear

- https://www.pullandbear.com/gb/ — “PULL&BEAR United Kingdom | New Collection 2026 | Pull and Bear” — HTTP 200
- https://www.pullandbear.com/gb/faqs.html — “FAQs | Returns, shipping, exchanges and more | PULL&BEAR” — HTTP 200

## Bershka

- https://www.bershka.com/gb/shopping-guide.html?section=returns — “Shopping guide | Bershka” — HTTP 200
  - > 30 days time to return
  - > If a return is accepted after the 30-day window from your Shipping Confirmation, the refund will be issued via voucher instead. _(counts from dispatch)_
  - > Please note that defective items are exempt from this 30-day voucher rule and will always be refunded to your original payment method.
  - > Returns must be made within a maximum of 30 days from the shipping confirmation email. _(counts from dispatch)_
- https://www.bershka.com/gb/shopping-guide.html?section=general-info — “Shopping guide | Bershka” — HTTP 200
  - > 30 days time to return
  - > If a return is accepted after the 30-day window from your Shipping Confirmation, the refund will be issued via voucher instead. _(counts from dispatch)_
  - > Please note that defective items are exempt from this 30-day voucher rule and will always be refunded to your original payment method.
  - > Returns must be made within a maximum of 30 days from the shipping confirmation email. _(counts from dispatch)_

## Stradivarius

- https://www.stradivarius.com/gb/ — “Stradivarius United Kingdom - New Collection Autumn 2026 | United Kingdom” — HTTP 200
- https://www.stradivarius.com/gb/help-center/article/returns/how-to-return-a-product — “seo.help-center-article-page-title” — HTTP 200

## Massimo Dutti

- https://www.massimodutti.com/gb/help/faqs_section_returns-1/return-process — “Massimo Dutti” — HTTP 200
  - > For online orders, you have 30 days from the shipping date of your order to request a return. _(online, counts from purchase)_

## COS

- https://www.cos.com/en-gb — “Access Denied” — **unreadable: blocked by the site**
- https://www.cos.com/en-gb/customer-service/returns — “Access Denied” — **unreadable: blocked by the site**
- https://www.cos.com/en-gb/customer-service/how-to-return-items — “Access Denied” — **unreadable: blocked by the site**

## & Other Stories

- https://www.stories.com/en-gb — “Access Denied” — **unreadable: blocked by the site**
- https://www.stories.com/en-gb/customer-service/return-refund/ — “Access Denied” — **unreadable: blocked by the site**

## Arket

- https://www.arket.com/en-gb — “Access Denied” — **unreadable: blocked by the site**
- https://www.arket.com/en-gb/customer-service/returns/ — “Access Denied” — **unreadable: blocked by the site**

## Accessorize

- https://help.accessorize.com/hc/en-gb/articles/115000316211-What-is-your-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**
- https://www.accessorize.com/uk/returns.html — “Returns” — HTTP 200
  - > To try and help we have extended our Returns policy to 60 days and will be happy to answer any queries at all if you get in contact with our customer services team at customerservices@monsoon.co.uk.
  - > Simply return the goods in their original condition within 30 days of receipt.
  - > Customers are also entitled to cancel their order for a full refund as long as this is done within 14 working days of receipt of your goods. _(counts from delivery)_
  - > Please allow up to 14 days for your refund to be processed from the day you return the goods to us.
  - > All sale goods must be returned within 14 days of receipt.
  - > You may return unused products within 30 days of purchase with your Return's Note. _(counts from purchase)_

## Ann Summers

- https://support.annsummers.com/hc/en-gb/articles/19371781987996-What-is-your-returns-policy — “What is your returns policy? – Ann Summers” — HTTP 200
  - > If something isn’t quite right, you can return your items for free within 28 days of purchase, as long as they meet the conditions of our policy (e.g. unworn, unwashed, in original condition, with all tags, labels and hygiene and security seals intact (where applicable)). _(counts from purchase)_
  - > You can return eligible items within 28 days of purchase under our goodwill guarantee. _(counts from purchase)_
- https://support.annsummers.com/hc/en-gb/articles/19371240550556 — “Just a moment...” — **unreadable: blocked by the site**

## Thorntons

- https://www.thorntons.com/uk/en/terms-and-conditions — “Terms and Conditions | Thorntons” — HTTP 200
  - > If you are a consumer, have purchased any of our other products (which are not personalised items) and your order value is less than £250, you have a right to cancel the contract up to the end of the day which is 14 calendar days after the day on which you receive the goods in accordance with the following provisions. _(counts from delivery)_
  - > You must return the goods to us without delay and in any event not later than 14 calendar days after the day on which you let us know that you wish to cancel the contract.
  - > We will process your refund as soon as possible and in any case within 14 calendar days after the day on which we receive the goods back, or if earlier, within 14 calendar days after the day on which you provide evidence of having sent the goods back. _(counts from delivery)_
  - > If you have not received the goods from us before cancelling the contract and your order value is less than £250, we will make any refunds due to you within 14 days after you inform us of your decision to cancel the contract. _(counts from delivery)_

## Moonpig

- https://help.moonpig.com/en/articles/318763-can-i-return-an-order — “🔙 Can I return an order? | Moonpig Customer Service” — HTTP 200
  - > If your waiting for a refund for a order that's been returned to us, please allow up to 14 days from the day on which we receive the product back from you or, if earlier, the day on which you provide us with evidence that you have sent the product back to us. _(counts from delivery)_

## Funky Pigeon

- https://help.funkypigeon.com/hc/en-gb/articles/32645473532701-Can-I-return-my-non-personalised-gift — “Just a moment...” — **unreadable: blocked by the site**
- https://www.funkypigeon.com/terms-and-conditions — “Terms and Conditions | Funky Pigeon” — HTTP 200
  - > 3.15 For up to 30 days from the date of delivery, if your item is faulty you can get a refund. _(counts from delivery)_
  - > After 30 days and up to 6 months from the date of delivery, if your faulty item cannot be repaired or replaced, then you are entitled to a full refund. _(counts from delivery)_
  - > Non-personalised items purchased through funkypigeon.com can be returned within 14 days of receipt, or 14 days after Christmas. _(counts from purchase)_
  - > Request a refund within 14 working days after the item was delivered. _(counts from delivery)_
  - > Return it to us within 14 days of receipt for a full refund or exchange.
  - > You have 14 days from today (the start of your subscription) to cancel your subscription and receive a refund, minus a £5 administration fee and cost of any service used, set at £1.49 per ecard sent. _(counts from delivery)_
  - > Cancellation outside of the 14 day cooling off period will result in no refund.
  - > If a Force Majeure Event lasts longer than 30 days you may cancel your order without any further liability to us.

## Microsoft Store

- https://www.microsoft.com/en-GB/store/b/why-microsoft-store — “Microsoft Store Support & Return Policy for Surface, Xbox & More” — HTTP 200
  - > Free shipping and returns, 60-day low-price promise, as well as flexible payment options.
  - > Plus, enjoy 60-day returns on physical Microsoft products.
  - > Return process must be started within 60 days after customer receives the product.
  - > If you buy a physical product from Microsoft Store and we lower the price within 60 days, contact us and we’ll refund you the difference.
- https://support.microsoft.com/en-gb/accounts-billing/manage/get-an-exchange-or-refund-on-devices-bought-from-microsoft — “Get an exchange or refund on devices bought from Microsoft | Microsoft Support” — HTTP 200
  - > You can enjoy peace of mind with up to 60-day returns on physical Microsoft products, and if we lower the price within 60 days, contact Sales support and we'll refund you the difference. * Selected products & markets, terms apply.
  - > You have 60 days from delivery to return Surface devices and accessories purchased through the Microsoft Store with your work account. _(counts from delivery)_
  - > Microsoft 365 subscription returns vary by subscription status.
  - > Items outside the 60-day return window.
  - > I missed the 60-day return window
  - > Returns are not accepted after 60 days.

## Dell

- https://www.dell.com/en-gb/shop/lp/return-policy — “Returns | Dell UK” — HTTP 200
  - > Love your purchase or return it within 14 days* _(counts from purchase)_
  - > Dell will issue your refund, within 14 calendar days of receiving your return request. _(counts from delivery)_
  - > For Product order cancellations / returns – you have 14 calendar days in which to request cancellation of the purchase and return the Product, starting on the later of the day after:- 1) the day you receive your Order Confirmation OR 2) the date of delivery; _(counts from delivery)_
  - > For Services order cancellations / returns – you have 14 calendar days to cancel and return as above, starting on the day after the day you receive your Order Confirmation. _(counts from delivery)_
  - > If you cancel within the 14 days and you have requested or accepted performance of the Service, then you will be refunded pro-rata based on the Services performed up until the date of receipt by Dell of the cancellation notice.
  - > For Software order cancellations / returns - you have 14 calendar days to cancel and return as above, starting on the day after the day you receive your Order Confirmation, except that you lose your right to cancel if you download or begin using the Software during the 14-day cancellation period. _(counts from delivery)_
  - > For any other return query, including if more than 14 calendar days have passed since delivery of your order, please contact us using the “Contact Customer Support” button accessible through the Dell Order Support page. _(counts from delivery)_
  - > Refunds will be processed as soon as possible and you will usually be refunded within 14 calendar days of receipt by Dell of your cancellation notification.
  - > You must return Product(s) in their original condition and within 14 calendar days of your cancellation notification unless Dell provides a later collection date. _(counts from delivery)_

## Lenovo

- https://www.lenovo.com/gb/en/shopping-faq/# — “Lenovo Return Policy & Shopping FAQs | Lenovo UK” — HTTP 200
  - > You can request a return within 14 days of delivery _(counts from delivery)_
  - > Refunds are initiated within 14 working days after the returned item is received. _(counts from delivery)_
  - > If a fault occurs after the 14-day return period:
  - > If you purchased a qualifying Lenovo product from Lenovo.com between 22 April 2026 and 30 June 2026, registered your purchase within 14 days of the purchase date shown on your proof of purchase, and wish to claim a refund under our Price Promise, please submit your claim via Price Promise Claims Portal. _(counts from purchase)_

## HP Store

- https://www.hp.com/gb-en/shop/faq/returns — “Returns, Refunds and Replacements” — HTTP 200
- https://www.hp.com/gb-en/shop/faq/returns/how-hp-store-will-manage-my-refund — “Returns, Refunds and Replacements HP Store UK” — HTTP 200
  - > If you have initiated a return of your purchased items and you are expecting a refund, please note that HP will execute valid refund requests as soon as the goods are back into our warehouse, unless you are a consumer customer exercising your statutory right of withdrawal, in which case you will receive a refund within 14 days from the date of cancellation. _(counts from delivery)_

## Scan Computers

- https://www.scan.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.scan.co.uk/help/orders/returns/returns-policy — “Just a moment...” — **unreadable: blocked by the site**

## Overclockers UK

- https://www.overclockers.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.overclockers.co.uk/returns — “Just a moment...” — **unreadable: blocked by the site**

## Laptops Direct

- https://www.laptopsdirect.co.uk/content/cancellation-returns-process — “Cancel Your Order | Laptops Direct” — HTTP 200
  - > You may cancel your order within 14 days from the day following delivery subject to the following conditions and returns process: _(counts from delivery)_
  - > You must cancel in writing within 14 days from delivery. _(counts from delivery)_
  - > (Returned goods that were not cancelled in writing within 14 days will be returned to you for an administration fee of £49)
  - > We will refund you within 30 days of receipt of your goods. _(counts from delivery)_

## Appliances Direct

- https://www.appliancesdirect.co.uk/help-and-advice/product-support/aftersales#cancelreturn — “After You've Ordered | Appliances Direct” — HTTP 200
  - > Ordered the wrong item? Or not happy with the product? Simply contact us within 30 days from the day after delivery to return your order. _(counts from delivery)_
  - > Customers must return their WEEE item to us within 28 days of purchasing their new item.

## Hughes

- https://www.hughes.co.uk/returns — “Returns | Hughes” — HTTP 200
  - > You must return your goods within 14 days of return request.
  - > Returns requests must be made within 14 days after your delivery and under the following conditions for a full refund: _(counts from delivery)_
  - > After you have notified us you wish to return the item, the goods must then be returned at your own expense, within 14 days of your notice to us to the below address:
  - > If you have broken the seal on selected items, including headphones, you will not be able to return the product even if it’s within the 14-day time frame.
  - > If your item has a confirmed fault within 30 days of delivery, you will be able to return this as an exchange or for a full refund. _(counts from delivery)_

## Euronics

- https://www.euronics.co.uk/returns-&-cancellations — “Returns & Cancellations | Euronics Site” — HTTP 200
  - > If the fault is confirmed within 30 days of delivery, we will have it either, repaired, replaced, or give you a full refund, including home delivery charges. _(online, counts from delivery)_

## Sonos

- https://support.sonos.com/en-gb/article/return-your-sonos-product — “Return your Sonos product | Sonos” — HTTP 200
- https://www.sonos.com/en-gb/shipping-faq — “Dispatch FAQ | Sonos” — HTTP 200
  - > If you have returned the product under the 30 day return policy, provided your return meets the needed conditions, you may expect to see a credit to your account within 10 – 15 working days.

## Bose

- https://www.bose.co.uk/returns — “Bose Returns & FAQs | Bose” — HTTP 200
  - > What if my product is outside both the Warranty period, and the 30-day return period?
  - > Your return request must be received by Bose within 30 days of receipt. _(counts from delivery)_
  - > Package the product with all accessories and deliver the package to Bose within 30 days of initiating your return.
  - > Bose covers return delivery for items returned within 30 days of receipt, when purchased on Bose.co.uk. _(counts from delivery)_

## Harvey Nichols

- https://www.harveynichols.com/ — **unreadable: HTTP 502**
- https://www.harveynichols.com/info/help/delivery-help/returns/ — **unreadable: HTTP 502**

## Fortnum & Mason

- https://support.fortnumandmason.com/hc/en-gb/articles/360002788698-How-do-I-return-an-item — “How do I return an item? – Fortnum & Mason” — HTTP 200
  - > Please note that the goods must be returned to us within 14 days of notifying us of your return request.
  - > When the goods have been received and checked, a refund (or an e-gift card) for the goods and the standard delivery charge (premium charges are not refundable) will be issued within 14 days. _(counts from delivery)_
- https://www.fortnumandmason.com/terms-and-conditions — “Terms and Conditions” — HTTP 200
  - > You have the right to cancel your order made online or over the telephone within a ‘cooling off’ period of 14 days from the day after you receive the goods. _(online, counts from delivery)_
  - > You will be given instructions about where to return the goods which must be made without undue delay and in any case within 14 days of notifying us.
  - > When the goods have been received and checked, a refund for the goods and the standard delivery charge (premium charges are not refundable) will be issued within 14 days. _(counts from delivery)_
  - > For goods purchased in one of our stores, you may return those goods within 30 days of purchase along with your receipt. _(in store, counts from purchase)_
  - > If you take delivery of a package from us and the goods being delivered to you have been damaged in transit, or are defective, not as described, not of satisfactory quality, not fit for purpose, or are not per a sample, we will at your option either exchange or repair these items without charge to you, or provide you with a full refund, if the fault is notified to us within 30 days of you receiving the product. _(online, counts from delivery)_
  - > Beyond 30 days, we will provide you with either an exchange or repair in accordance with the Consumer Rights Act 2015.

## Joe Browns

- https://www.joebrowns.co.uk/returns — “Returns Information | Joe Browns Official Website” — HTTP 200
  - > We hope you’ll be delighted with your purchase, but if for any reason something’s not quite right, you can return your item for free within 28 days from the day after you receive your order. _(counts from delivery)_
  - > We hope that you love the products that you buy from us, but you can tell us that you wish to cancel your order and return the goods at any time up to 14 days after the day on which you receive your complete order. _(counts from delivery)_
  - > You must return your goods to us within 14 days of notifying us that you wish to cancel your order.
  - > (if earlier) 14 days after the day you provide evidence that you have returned the goods to the address given above; or
  - > if the goods were not sent to you, 14 days after the day on which you tell us that you wish to cancel the order (where debit or credit card payments are concerned, no payment is taken for an order that is cancelled prior to us despatching any goods to you).

## Sosandar

- https://www.sosandar.com/returns — “Returns” — HTTP 200
  - > Our standard returns policy is 14 days.
  - > You have 14 days from delivery to return your items. _(counts from delivery)_
  - > Refunds are processed within 7 working days of receiving your return. _(counts from delivery)_
- https://help.sosandar.com/hc/en-gb/articles/18169993767441-What-is-your-returns-policy — “Just a moment...” — **unreadable: blocked by the site**

## Hush

- https://www.hush-uk.com/ — “Vercel Security Checkpoint” — **unreadable: blocked by the site**
- https://www.hush-uk.com/faq — “Vercel Security Checkpoint” — **unreadable: blocked by the site**

## Nobody's Child

- https://www.nobodyschild.com/en-us/pages/returns — “Returns policy” — HTTP 200
  - > Full-Price Items: Return within 30 days of receipt
  - > Sale or Markdown Items: Return within 14 days of receipt
  - > Once you have notified us of your decision to withdraw via the returns portal, you must return the goods to us without undue delay and, in any event, no later than 14 days from the date on which you submitted your withdrawal request.
  - > For all full price items, we accept returns within 30 days of receiving your order if it's in perfect condition, unworn, and with the tags still attached. _(counts from delivery)_
  - > For all sale and markdown items, we accept returns within 14 days of receipt.
  - > We accept returns for all full price items within 30 days of receiving your order if it's in perfect condition, unworn and has the tags still attached. _(counts from delivery)_
  - > For all sale items or orders placed with a voucher code, we accept returns within 14 days of purchase. _(counts from purchase)_
  - > We accept returns for all full price items within 30 days of receiving your order, for all sale or markdown items we accept returns within 14 days of receipt. _(counts from delivery)_
  - > It can take up to 7 working days to process your return after your order arrives back with us.
  - > For store orders, please return to one of our stores within 30 days for full price items and 14 days for sale or markdown items and our staff will issue you with an exchange or refund.
  - > If you do not return the original item within 14 days of the exchange, this payment method will be charged for the non-returned item.

## ME+EM

- https://www.meandem.com/us/returns — “Returns | ME+EM” — HTTP 200
  - > Returns Period: 14 days
  - > All products must be returned within 14 days of receipt of your order and must be returned in new, unused, unwashed condition, not modified in any way. _(counts from delivery)_
  - > It may take up to 14 days for us to receive your return. _(counts from delivery)_
  - > Once your return has been received at our warehouse we will inspect the returned product(s) and providing the order has been sent back as per our Returns Policy, we will process your return request, which may take up to 7 days from our receipt of your returned Product(s), and will send you an email notification once your refund has been processed. _(counts from delivery)_
  - > Unless a product is marked ‘FINAL SALE’ you have up to 14 days of receipt of your order to return your sale purchase. _(counts from delivery)_
  - > It can take up to 14 days for your return to reach us from the date of posting using our free returns carrier.
  - > Once your return has been received at our warehouse, we will inspect the returned product(s) and providing the order has been sent back as per our Returns Policy, a full refund will be issued within 7 days of receiving your returned goods. _(counts from delivery)_
  - > In order to benefit from any further reductions, if your full price product is still within the 14 days return period, please return the full price product for a refund and then repurchase the product at the new sale price.
  - > Refund times: Refunds may take up to 21 days from posting.
  - > Purchases made on or after Monday 22nd December 2025 will be subject to the standard 14 days returns policy.
  - > You will need to return the original item to us within 7 days and it must be returned new, unused, unwashed, not modified in any way and with all accessories e.g. belts, and in the original packaging with all ME+EM garment tags and labels attached.

## Rixo

- https://rixolondon.com/en-us/pages/returns — “Returns | RIXO USA ⋆” — HTTP 200
  - > Please allow up to 10 working days from date of receipt for your refund to be processed, once processed, you will receive separate email confirmation of this. _(counts from delivery)_
  - > If you haven't yet received your refund confirmation after 10 working days, please contact us. _(counts from delivery)_
  - > Our online returns policy allows returns within 14 days of delivery (for online orders), or within 7 days of purchase (for in-store purchases). _(counts from delivery)_
  - > RIXO x Stripe & Stare items (excluding underwear) may be returned up to 14 days from the delivery date for online purchases or date of purchase if shopping in store. _(counts from delivery)_

## Free People

- https://www.freepeople.com/uk/ — “freepeople.com” — **unreadable: blocked by the site**
- https://www.freepeople.com/uk/help/returns-exchanges/ — “freepeople.com” — **unreadable: blocked by the site**

## Anthropologie

- https://www.anthropologie.com/en-gb — “anthropologie.com” — **unreadable: blocked by the site**
- https://www.anthropologie.com/en-gb/help/returns-exchanges — “anthropologie.com” — **unreadable: blocked by the site**

## Coast

- https://www.coastfashion.com/pages/informational/returns — “Returns Information | Coast” — HTTP 200
  - > • From the day you receive your order, you must return your item to us within 21 days to secure your refund or store credit. _(counts from delivery)_
  - > When you purchase Coast Deliver+, you will have an extra 14 days on top of our stanard 21-day window to initate a return. _(counts from purchase)_
  - > • Refunds can take up to 14 days from the date your return is posted.
  - > If you are a customer in the European Economic Area (EEA) and you order an item online, you get 14 calendar days to cancel your order because you have changed your mind. _(online)_
  - > Items must be returned within 21 days of receipt.
  - > Cash Refunds for returns can take up to 14 days from the date they were posted back.
  - > Please be aware that the refund can then take up to 5 days to appear in your bank depending on who you bank with.
  - > If you believe there is an error with your refund, please head over to our contact us section within 14 days so we can resolve it quickly for you.
  - > If you’re a customer in the UK or EEA, you have the legal right to cancel your contract if you change your mind until 14 days after you receive (or someone you nominate receives) the products, unless the products are split into several deliveries over different days. _(counts from delivery)_
  - > When you purchase Coast Deliver+, you can initiate returns within 14 days after expiration of Coast 21-day standard return window period. _(counts from purchase)_
  - > You must return the product within 7 days from initiating the return request.
  - > If you are eligible for a refund under the Seel Return Policy, Seel shall initiate the refund directly to you within 2 days from when Seel approved the return and refund of the product.
  - > For example, if Coast offers 14 days for returns and you purchase the Worry Free Purchase Product, you shall have an additional 7 days starting from day 15, giving you until day 21 from delivery to initiate a return. _(counts from delivery)_

## Karen Millen

- https://www.karenmillen.com/pages/informational/returns — “Returns Information | Karen Millen” — HTTP 200
  - > Refunds for returns can take up to 14 days from the date they were posted back.
  - > Please be aware that the refund can then take up to 5 days to appear in your bank depending on who you bank with.
  - > Once a refund has been approved by us we will refund your payment to your original payment method (i.e. card, etc) within 14 days.
  - > If you are a customer in the European Economic Area (EEA) and you order an item online, you get 14 calendar days to cancel your order because you have changed your mind. _(online)_
  - > Items must be returned within 21 days of receipt.
  - > If you’re a customer in the UK or EEA, you have the legal right to cancel your contract if you change your mind until 14 days after you receive (or someone you nominate receives) the products, unless the products are split into several deliveries over different days. _(counts from delivery)_

## In The Style

- https://www.inthestyle.com/pages/returns — “RETURNS – InTheStyle” — HTTP 200
  - > We get that you can change your mind from time to time, so we’ve made our returns process as easy as possible to help.You have 14 days to return any unworn unwanted items to us from the day you receive your parcel. _(counts from delivery)_
- https://www.inthestyle.com/policies/refund-policy — “Refund policy – InTheStyle” — HTTP 200
  - > If you change your mind about any Items purchased, you must generate a return on our Returns Portal within 14 days of the goods arriving with you. _(counts from purchase)_
  - > Please return them to us (except beauty products, pierced jewellery, lingerie or swimwear if the hygiene seal has been removed or any other item that cannot be returned for health or hygiene reasons) within 14 days of the order being delivered to you, provided: _(online, counts from delivery)_
  - > Refunds will be processed within 14 days of being received into our warehouse. _(counts from delivery)_

## Quiz

- https://www.quizclothing.co.uk/ — “Quiz Clothing” — HTTP 200
- https://help.quizclothing.co.uk/hc/en-gb/articles/360014671120-How-do-I-return-an-item-purchased-online- — **unreadable: HTTP 502**
- https://help.quizclothing.co.uk/hc/en-gb/articles/360011637480-Do-I-have-to-pay-for-returning-an-item — **unreadable: HTTP 502**

## Yours Clothing

- https://www.yoursclothing.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.yoursclothing.co.uk/returns-policy — “Just a moment...” — **unreadable: blocked by the site**

## Roman Originals

- https://www.roman.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.roman.co.uk/help/returns — “Just a moment...” — **unreadable: blocked by the site**

## Damart

- https://www.damart.co.uk/ — “Stylish & comfortable ladies clothing, shoes & thermals | Damart” — HTTP 200
- https://www.damart.co.uk/delivery-and-returns — “Delivery and Returns” — HTTP 200
- https://www.damart.co.uk/delivery-and-returns?ua_zoning=sitebanner_aw26_wk3_delivery_returns — “Delivery and Returns” — HTTP 200

## Cotton Traders

- https://www.cottontraders.com/customer-service/information/returns.html — “Returns at Cotton Traders” — HTTP 200
  - > You are entitled to cancel your order if you so wish, providing that you exercise your right no longer than 14 days after the day on which you receive the goods. _(counts from delivery)_
  - > If you decide to cancel, you should return your order to us at your own cost within 14 days of such cancellation and we will reimburse to you (by the method used to pay for the original transaction, postal orders will be refunded by cheque) the amount in relation to goods to which cancellation rights apply.

## Lands' End

- https://www.landsend.co.uk/Returns/co/mobile-cs-returns.html — “Returns | Lands' End” — HTTP 200
  - > Eligible returns for a refund received within 90 days of purchase will be issued to the original form of payment and should be accompanied by a Lands’ End proof of purchase. _(counts from delivery)_
  - > If you return your entire order within 28 days we will refund the full invoice amount, including original shipping costs.
  - > If there is a quality issue, you may return the item in new condition for a full refund within 90 days of purchase. _(counts from purchase)_
  - > When your return has been processed through our online returns portal, your refund will be issued within 1-2 days after your return is scanned at the parcel shop. _(online)_
  - > The refund will be credited back to your original payment method, and you can expect to receive the funds in your bank account within 3-5 days. _(counts from delivery)_
  - > The return is requested within the valid return period - 90 days.
  - > What happens if I return my items after 90 days?
  - > As detailed in our Returns Policy, any eligible returns must be sent back to us within 90 days.
  - > If you return an item outside the 90-day period, we will be unable to send the item back to you.
  - > You may return a gift within 90 days of receiving it. _(counts from delivery)_
  - > The refund will be processed 1-2 working days from when your parcel is scanned at the drop off point.
  - > If you're returning your item through our online returns portal, please allow 1–2 working days from the time of drop-off for us to issue your refund. _(online)_
  - > For returns made via alternative methods outside of our online returns portal, it typically takes 5–7 working days for your parcel to reach us at Lands’ End. _(online)_
  - > Once received, please allow 1–2 working days for us to process your return. _(counts from delivery)_
  - > After we issue your refund, your bank may take 2–5 working days to credit the amount back to your account.
  - > If you reside within the UK or the EU, these regulations stipulate that if you cancel your entire order within 14 days of receipt of your goods, we should refund the standard postage costs you paid as part of that order. _(counts from delivery)_
  - > We will not refund any postage charges if you cancel after 28 days' notice of receipt – or if you only cancel part of your order.
  - > Items can be returned within 90 days of purchase. _(counts from purchase)_

## The White Company

- https://www.thewhitecompany.com/uk/ — “Page Not Found | The White Company US” — **unreadable: HTTP 404**
- https://www.thewhitecompany.com/us/?countryIsoCode=US&currencyIsoCode=USD&clear=true — “The White Company - US” — HTTP 200

## Brora

- https://www.brora.co.uk/ — **unreadable: HTTP 502**
- https://www.brora.co.uk/our-site/terms-conditions — **unreadable: HTTP 502**
- https://www.brora.co.uk/customer-service/return-faulty-or-incorrect-products — **unreadable: HTTP 502**

## Toast

- https://www.toa.st/pages/returns — “Returns | How to Return an Item | TOAST” — HTTP 200
  - > Full price items purchased online may be returned for a refund within 28 days of receiving them. _(online, counts from delivery)_
  - > Sale items purchased online may be returned for a refund within 14 days of receiving them. _(online, counts from delivery)_
  - > During busy periods, please allow up to 10 working days for your return to be processed once it is received into our warehouse. _(counts from delivery)_
  - > Once a refund has been issued, please allow up to 5 working days for this to appear on your account.
  - > You may cancel your entire order within 14 days of receiving it by notifying us of your intention to cancel. _(counts from delivery)_
  - > Full price items can be returned within 28 days of the purchase date for a refund or exchange. _(counts from purchase)_
  - > Sale items may be returned for an exchange or a gift card for the amount within 14 days of purchasing them.
  - > Try on and return pieces within 5 days.
