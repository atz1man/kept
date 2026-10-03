# Candidate retailers, read from their own sites — 2026-10-03

Written by `npm run check:retailers -- --candidates`. Each homepage was opened and the shop's own Returns/Refunds links followed. The periods column counts how often each number appears in a sentence about returns: a summary to read the quotes against, never a value to copy. A shop goes into `stores.ts` by hand, from the quotes, with its returns page added to `retailer-sources.json` in the same change.

| Shop | Status | Periods named | Clock named |
|---|---|---|---|
| Asda | unreadable: blocked by the site | — | — |
| Morrisons | no returns link found | — | — |
| Waitrose | unreadable: HTTP 502 | — | — |
| Aldi | unreadable: blocked by the site | — | — |
| Lidl | read | 28 days ×1, 30 days ×1, 365 days ×1 | purchase |
| Selfridges | no window found | — | — |
| Harrods | unreadable: blocked by the site | — | — |
| Fenwick | read | 14 days ×4, 28 days ×1 | purchase, delivery |
| Liberty | read | 30 days ×5, 14 days ×4 | delivery, purchase |
| House of Fraser | unreadable: HTTP 502 | — | — |
| Debenhams | read | 14 days ×8, 21 days ×6, 2 days ×1, 5 days ×1, 7 days ×1 | delivery, purchase |
| Primark | unreadable: blocked by the site | — | — |
| New Look | unreadable: blocked by the site | — | — |
| River Island | read | 14 days ×3, 28 days ×2, 10 days ×1 | delivery |
| TK Maxx | unreadable: blocked by the site | — | — |
| Matalan | read | 28 days ×10, 14 days ×3, 5 days ×2, 3 days ×1, 7 days ×1, 365 days ×1 | delivery, dispatch |
| Mango | unreadable: blocked by the site | — | — |
| Boohoo | read | 14 days ×4, 21 days ×3, 7 days ×1 | delivery |
| PrettyLittleThing | read | 21 days ×3, 14 days ×2, 7 days ×1 | delivery |
| Shein | no returns link found | — | — |
| Very | unreadable: blocked by the site | — | — |
| JD Sports | no window found | — | — |
| Schuh | unreadable: blocked by the site | — | — |
| Clarks | read | 14 days ×5, 28 days ×3, 5 days ×1, 10 days ×1, 30 days ×1 | purchase, delivery |
| FatFace | no window found | — | — |
| White Stuff | read | 14 days ×5, 5 days ×3, 30 days ×3, 7 days ×1 | purchase, delivery |
| Joules | no returns link found | — | — |
| Superdry | no window found | — | — |
| Urban Outfitters | unreadable: blocked by the site | — | — |
| Monsoon | read | 10 days ×3, 14 days ×3, 30 days ×2, 28 days ×1 | delivery, purchase |
| Reiss | no window found | — | — |
| AllSaints | read | 28 days ×3 | purchase, delivery |
| Office | unreadable: blocked by the site | — | — |
| Footasylum | unreadable: blocked by the site | — | — |
| Nike | read | 14 days ×2, 30 days ×2, 16 days ×1 | delivery |
| Adidas | unreadable: blocked by the site | — | — |
| Lululemon | unreadable: blocked by the site | — | — |
| AO | unreadable: blocked by the site | — | — |
| Samsung | no returns link found | — | — |
| Richer Sounds | no window found | — | — |
| CeX | no returns link found | — | — |
| GAME | unreadable: HTTP 502 | — | — |
| Smyths | unreadable: blocked by the site | — | — |
| The Entertainer | unreadable: blocked by the site | — | — |
| Hamleys | unreadable: blocked by the site | — | — |
| Dyson | read | 35 days ×4, 14 days ×3 | delivery |
| Dunelm | read | 28 days ×5, 5 days ×3, 10 days ×3, 14 days ×3, 30 days ×3 | purchase, delivery |
| The Range | unreadable: blocked by the site | — | — |
| B&M | read | 30 days ×2, 365 days ×1 | purchase |
| Homebase | unreadable: blocked by the site | — | — |
| Toolstation | read | 30 days ×7, 14 days ×2, 5 days ×1, 10 days ×1 | purchase, delivery |
| Habitat | read | 14 days ×5, 30 days ×1 | delivery |
| DFS | unreadable: blocked by the site | — | — |
| Furniture Village | no window found | — | — |
| Oak Furnitureland | read | 3 days ×1 | delivery |
| Wayfair | unreadable: blocked by the site | — | — |
| Lakeland | no window found | — | — |
| Robert Dyas | read | 5 days ×2, 30 days ×1 | purchase |
| Hobbycraft | unreadable: blocked by the site | — | — |
| The Works | no returns link found | — | — |
| Superdrug | unreadable: blocked by the site | — | — |
| Lush | unreadable: blocked by the site | — | — |
| The Body Shop | read | 45 days ×1 | — |
| Space NK | no window found | — | — |
| Lookfantastic | read | 5 days ×2, 30 days ×2, 7 days ×1, 10 days ×1 | delivery |
| Sephora | unreadable: blocked by the site | — | — |
| Holland & Barrett | read | 30 days ×2, 5 days ×1, 7 days ×1, 14 days ×1 | purchase, delivery |
| Waterstones | unreadable: blocked by the site | — | — |
| WHSmith | unreadable: HTTP 502 | — | — |
| Ryman | unreadable: blocked by the site | — | — |
| Mountain Warehouse | read | 60 days ×1 | — |
| Go Outdoors | read | 14 days ×3, 28 days ×2 | delivery |
| Cotswold Outdoor | no returns link found | — | — |
| Halfords | unreadable: blocked by the site | — | — |
| Pets at Home | read | 30 days ×4, 5 days ×1, 14 days ×1 | purchase, delivery |
| JoJo Maman Bébé | read | 14 days ×4, 5 days ×1, 10 days ×1 | delivery |

## Asda

- https://www.asda.com/ — “Just a moment...” — **unreadable: blocked by the site**

## Morrisons

- https://www.morrisons.com/ — “Morrisons - Groceries, Offers, Recipes & More” — HTTP 200

## Waitrose

- https://www.waitrose.com/ — **unreadable: HTTP 502**

## Aldi

- https://www.aldi.co.uk/ — “Access Denied” — **unreadable: blocked by the site**

## Lidl

- https://www.lidl.co.uk/ — “Food, Non-food, Wine and Recipes | Lidl GB” — HTTP 200
- https://www.lidl.co.uk/c/refund-policy/s10022914 — “Refund Policy | Lidl GB” — HTTP 200
  - > If you are not satisfied with the quality of a non-food specials item purchased at one of our stores, you may return the item within one year of purchase with your receipt or proof of purchase to one of our stores, for a replacement (where available) or a full refund. _(counts from purchase)_
  - > If you simply change your mind about a non-food specials item purchased at one of our stores, you may still return the product to store for a full refund within 30 days of purchase. _(counts from purchase)_
  - > You will have to return it (and any free gifts provided with it) to us within 28 days of your telling us you have changed your mind.

## Selfridges

- https://www.selfridges.com/GB/en/ — “Designer Fashion, Accessories & More - Shop Online at Selfridges” — HTTP 200
- https://www.selfridges.com/GB/en/info/returns/ — “Attention Required! | Cloudflare” — **unreadable: blocked by the site**

## Harrods

- https://www.harrods.com/en-gb/ — “Access Denied” — **unreadable: blocked by the site**

## Fenwick

- https://fenwick.co.uk/ — “Fenwick | UK Department Store | Fashion, Beauty, & More” — HTTP 200
- https://fenwick.co.uk/pages/refunds-exchanges — “Returning your order – Fenwick” — HTTP 200
  - > Subject to the terms and exclusions below, any full price or sale item, purchased in one of our stores, can be returned for FREE for a full refund to your original payment method, up to 14 days from the date of purchase. _(in store, counts from purchase)_
  - > Full price items returned 15 to 28 days following the date of purchase shall be refunded onto a Fenwick Gift Card or exchange only. _(counts from purchase)_
  - > Subject to the terms and exclusions below, you can return any items purchased online for FREE up to 14 days from delivery for a full refund to your original payment method. _(online, counts from delivery)_
  - > Returns will be refunded within 14 days of us receiving your returned item/s. _(counts from delivery)_
  - > Post Delivery - If after receiving your online order, you wish to return any items, you have up to 14 days from the day you receive your items to contact us. _(online, counts from delivery)_

## Liberty

- https://www.libertylondon.com/ — “Liberty | Designer Department Store Selling Luxury Brands” — HTTP 200
  - > 30 Day Return
  - > Free 30 Days Returns
- https://www.libertylondon.com/uk/information/delivery-and-returns.html — “Delivery and Returns | Liberty” — HTTP 200
  - > 30 Day Return
  - > If you wish to withdraw your order within 14 days of delivery and receive a full refund, please click here. _(counts from delivery)_
  - > You have up to 30 days to return an item.
  - > Refunds will be made back to your original payment method within 14 days of us receiving the returned goods. _(counts from delivery)_
  - > Purchases made in the Liberty store must be returned to the store within 14 days of purchase. _(counts from purchase)_
  - > For online purchases, you have up to 30 days from receipt of the item to return the goods, subject to our Online Returns Policy. _(online, counts from delivery)_
  - > For in-store purchases, you have 14 days from the date of purchase to return the goods, subject to our In Store Returns Policy. _(in store, counts from purchase)_
  - > Free 30 Days Returns
- https://www.libertylondon.com/us/information/delivery-and-returns.html — “Shipping and Returns | Liberty” — HTTP 200
  - > If you wish to withdraw your order within 14 days of delivery and receive a full refund, please click here. _(counts from delivery)_
  - > You have up to 30 days to return an item.
  - > Refunds will be made back to your original payment method within 14 days of us receiving the returned goods. _(counts from delivery)_
  - > Purchases made in the Liberty store must be returned to the store within 14 days of purchase. _(counts from purchase)_
  - > For online purchases, you have up to 30 days from receipt of the item to return the goods, subject to our Online Returns Policy. _(online, counts from delivery)_
  - > For in-store purchases, you have 14 days from the date of purchase to return the goods, subject to our In Store Returns Policy. _(in store, counts from purchase)_
  - > Free returns within 30 days

## House of Fraser

- https://www.houseoffraser.co.uk/ — **unreadable: HTTP 502**

## Debenhams

- https://www.debenhams.com/ — “Fashion, Home & Beauty | Debenhams” — HTTP 200
- https://www.debenhams.com/track-and-return — “Track Or Return Your Order” — HTTP 200
- https://www.debenhams.com/pages/informational/returns — “Returns Information | Debenhams” — HTTP 200
  - > You have 21 days to return your item
  - > • From the day you receive your order, you must return your item to us within 21 days to secure your refund or store credit. _(counts from delivery)_
  - > When you purchase Debenhams Deliver+, you will have an extra 14 days on top of our standard 21-day window to initate a return. _(counts from purchase)_
  - > Refunds take 14 days to process
  - > • Once we’ve received your return, it can take up to 14 days to be processed. _(counts from delivery)_
  - > If you are a customer in the European Economic Area (EEA) and you order an item online, you get 14 calendar days to cancel your order because you have changed your mind. _(online)_
  - > Items must be returned within 21 days of receipt.
  - > When you purchase Debenhams Deliver+, you will have an extra 14 days on top of our stanard 21-day window to initate a return. _(counts from purchase)_
  - > Cash Refunds for returns can take up to 14 days from the date they were posted back.
  - > Please be aware that the refund can then take up to 5 days to appear in your bank depending on who you bank with.
  - > If you’re a customer in the UK or EEA, you have the legal right to cancel your contract if you change your mind until 14 days after you receive (or someone you nominate receives) the products, unless the products are split into several deliveries over different days. _(counts from delivery)_
  - > When you purchase Debehams Deliver+, you can initiate returns within 14 days after expiration of Debenhams 21-day standard return window period. _(counts from purchase)_
  - > You must return the product within 7 days from initiating the return request.
  - > If you are eligible for a refund under the Seel Return Policy, Seel shall initiate the refund directly to you within 2 days from when Seel approved the return and refund of the product.

## Primark

- https://www.primark.com/en-gb — “Planned maintenance” — **unreadable: blocked by the site**

## New Look

- https://www.newlook.com/uk — “Access to this page has been denied” — **unreadable: blocked by the site**

## River Island

- https://www.riverisland.com/ — “River Island: Fashion Clothing for Women, Men, Boys and Girls” — HTTP 200
- https://www.riverisland.com/customer-support/frequently-asked-questions/returns-and-refunds — “Returns And Refunds - Frequently Asked Questions - Customer-Support - River Island” — HTTP 200
  - > Please then allow up to 10 days for your refund to appear in your account.
  - > If you are returning an item from the Republic of Ireland, we aim to review your return and start your refund within 14 calendar days of dropping off you parcel with your chosen courier.
  - > You can return or exchange a gift within 28 days if you have a gift receipt or regular receipt.
- https://www.riverisland.com/returns — “Returns - River Island” — HTTP 200
- https://www.riverisland.com/how-can-we-help/returns — “Returns - How Can We Help - River Island” — HTTP 200
  - > Items can be returned within 28 days of delivery or store purchase _(counts from delivery)_
  - > Remember to drop off your return within 14 days.
  - > Please drop off your return within 14 days.

## TK Maxx

- https://www.tkmaxx.com/uk/en/ — “TKMaxx.com: Something went wrong” — **unreadable: blocked by the site**

## Matalan

- https://www.matalan.co.uk/ — “Womens, Mens, Kids & Home | Matalan” — HTTP 200
- https://www.matalan.co.uk/c/customer-services/returns-cancellations/ — “Returns Policy & Order Cancellation Procedure | Matalan” — HTTP 200
  - > We’ll be happy to refund within 28 days of purchase if you bought the items in store, or within 28 days of you receiving the items if you ordered them online. _(counts from delivery)_
  - > These rights are not affected by our 28-day returns policy.
  - > For online orders, we offer refunds within 28 days of you receiving the items. _(online, counts from delivery)_
  - > Once we've received your parcel back at our warehouse, we'll process your refund within 14 days of receiving your returned items. _(counts from delivery)_
  - > The QR code expires 7 days after generation, so please return your parcel within this time.
  - > InPost will collect your parcel, apply a label, and ensure it is returned to the retailer within 1–3 working days.
  - > We’ll be happy to refund free of charge within 28 days of you receiving the items ordered online. _(online, counts from delivery)_
  - > We’ll be happy to refund free of charge within 28 days of you receiving the items ordered online.Items must be returned in the condition they were purchased, including all packaging, along with the delivery note filled in with the reason for the return. _(online, counts from delivery)_
  - > We’ll be happy to exchange or refund free of charge within 28 days of you receiving the items ordered online. _(online, counts from delivery)_
  - > We’ll be happy to exchange or refund free of charge within 28 days of you receiving the items ordered online.Items must be returned in the condition they were purchased, including all packaging, along with the delivery note filled in with the reason for the return. _(online, counts from delivery)_
  - > We'll be happy to exchange or refund free of charge to stores within 28 days of you receiving the items ordered online. _(online, counts from delivery)_
  - > We are happy to refund the item(s) you've brought within 28 days of delivery. _(counts from delivery)_
  - > Unopened items may be returned within 28 days of receipt in the form of original payment method.
  - > Klarna RefundsOnce Matalan have processed the return, a refund will be processed within 3 to 5 days and show in your Klarna account.
  - > Example: if we provide you with a Dispatch Confirmation on 1 January in respect of goods to be delivered at regular intervals over a year and you receive the first delivery of your Product on 10 January, you may cancel at any time between 1 January and the end of the day on 24 January. _(counts from dispatch)_
  - > For example, if we offer delivery of goods within 3-5 days at one cost but you choose to have the goods delivered within 24 hours at a higher cost, then we will only refund what you would have paid for the cheaper delivery option. _(counts from delivery)_
  - > -If you have not received the goods or you have received it and we have offered to collect it from you: 14 working days after you inform us of your decision to cancel the contract. _(counts from delivery)_
  - > You must return it to us without undue delay and in any event not later than 14 days after the day on which you let us know that you wish to cancel the contract.

## Mango

- https://shop.mango.com/gb — “Vercel Security Checkpoint” — **unreadable: blocked by the site**

## Boohoo

- https://www.boohoo.com/ — “boohoo | Womens and Mens Clothes | Shop Online Fashion” — HTTP 200
- https://www.boohoo.com/track-and-return — “Track Or Return Your Order” — HTTP 200
- https://www.boohoo.com/pages/informational/returns — “Returns Information | boohoo” — HTTP 200
  - > You have 21 days to return your item
  - > From the day you receive your order, you must return your item to us within 21 days to secure your refund or gift card. _(counts from delivery)_
  - > Once we’ve received your return, it can take up to 14 days to be processed. _(counts from delivery)_
  - > If you are a customer in the European Economic Area (EEA) and you order an item online, you get 14 calendar days to cancel your order because you have changed your mind. _(online)_
  - > Items must be returned within 21 days of receipt.
  - > For example, if boohoo offers 14 days for returns and you purchase the Worry Free Purchase Product, you shall have an additional 7 days starting from day 15, giving you until day 21 from delivery to initiate a return. boohoo Deliver+ is powered by Seel. _(counts from delivery)_
  - > If you’re a customer in the UK or EEA, you have the legal right to cancel your contract if you change your mind until 14 days after you receive (or someone you nominate receives) the products, unless the products are split into several deliveries over different days. _(counts from delivery)_

## PrettyLittleThing

- https://www.prettylittlething.com/ — “Women's Clothing | Shop Online Fashion | PLT” — HTTP 200
- https://www.prettylittlething.com/pages/informational/returns — “Returns & Refunds | PLT UK” — HTTP 200
  - > If you are a customer in the European Economic Area (EEA) and you order an item online, you get 14 calendar days to cancel your order because you have changed your mind. _(online)_
  - > Items must be returned within 21 days of receipt.
  - > For example, if PrettyLittleThing offers 14 days for returns and you purchase the Worry Free Purchase Product, you shall have an additional 7 days starting from day 15, giving you until day 21 from delivery to initiate a return. _(counts from delivery)_
  - > Effective from 08.05.2026, you must let us know that you wish to return your item within 21 days of receiving your order. _(counts from delivery)_
  - > If you’re a customer in the UK or EEA, you have the legal right to cancel your contract if you change your mind until 21 days after you receive (or someone you nominate receives) the products, unless the products are split into several deliveries over different days. _(counts from delivery)_
- https://www.prettylittlething.com/account/track-and-return — “Track Or Return Your Order” — HTTP 200

## Shein

- https://www.shein.co.uk/ — “Women's & Men's Clothes, Shop Online Fashion | SHEIN UK” — HTTP 200

## Very

- https://www.very.co.uk/ — “Access Denied” — **unreadable: blocked by the site**

## JD Sports

- https://www.jdsports.co.uk/ — “JD Sports UK - Forever Forward” — HTTP 200
- https://www.jdsports.co.uk/page/delivery-returns/ — **unreadable: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at https://www.jdsports.co.uk/page/delivery-returns/**

## Schuh

- https://www.schuh.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**

## Clarks

- https://www.clarks.com/en-gb — “Clarks Shoes & Footwear | Sandals, Shoes, Boots & Accessories” — HTTP 200
- https://www.clarks.com/en-gb/returns-and-refunds — “Returns and Refunds | Clarks” — HTTP 200
  - > Items must be in their original condition, unworn and returned within 28 days of receipt, or for items purchased in a sale within 14 days. _(counts from purchase)_
  - > Faulty items should be returned via our Returns Portal within 30 days; after this period, please contact Customer Care.
  - > Please allow 5–10 days for the refund to appear in your account, although this may vary depending on your payment provider.
  - > Faulty goods within 28 days of order placed date (14 days for reduced price) can be logged through our Returns Portal.
  - > This can take up to 5 days once the returns is received. _(counts from delivery)_
  - > When you log an exchange request, you will need to send your item(s) back to Clarks within 14 days.
  - > Your item(s) may be ineligible for return if your order has exceeded 28 days from the time that the order was delivered (or 14 days for Sale items). _(counts from delivery)_
  - > If you have logged an exchange request through our Online Returns Portal, but have since changed your mind, your exchange request will be cancelled after 14 days if you don’t return your original order within 14 days. _(online)_

## FatFace

- https://www.fatface.com/ — “FatFace | Women's Clothing, Men's Clothing, Footwear & Accessories” — HTTP 200
- https://help.fatface.com/hc/en-gb/sections/24626148983825-Returns — “Just a moment...” — **unreadable: blocked by the site**

## White Stuff

- https://www.whitestuff.com/ — “White Stuff | Clothing, Footwear & Accessories | White Stuff” — HTTP 200
- https://www.whitestuff.com/returns-policy — “Returns | White Stuff” — HTTP 200
  - > Our returns policy entitles you to return items within 30 days and sale items within 14 days of purchase or receipt. _(counts from purchase)_
  - > You have 30 days from the date of receipt to reject the goods and obtain a full refund.
  - > If you return your whole order within 7 working days of receiving it, we will also refund your delivery cost (where applicable). _(counts from delivery)_
  - > We aim to process returns within 3-5 days once received but please bear with us, and if your refund hasn’t been received after 14 working days please contact us at customercare@whitestuff.com. _(counts from delivery)_
  - > Please note, once refunds have been processed and you have received the refund confirmation email, the transaction may take 3-5 working days to show up on your statement. _(counts from delivery)_
  - > Gift cards purchased online are subject to the Financial Services Distance Selling Regulations and the original purchaser may obtain a refund within 14 days of delivery by contacting our Customer Care Centre on 020 3752 5360. _(online, counts from delivery)_
  - > Our returns policy entitles you to return items purchased from a White Stuff outlet within 14 days of purchase or receipt. _(counts from purchase)_
- https://www.whitestuff.com/return — “White Stuff Returns | Fast & Easy Returns | White Stuff” — HTTP 200
  - > You can return full-price items within 30 days and sale items within 14 days of purchase or receipt. _(counts from purchase)_
  - > Please allow 3–5 working days from receiving your confirmation email for the refund to show on your statement, depending on your payment provider. _(counts from delivery)_

## Joules

- https://www.joules.com/ — “Joules | Women's, Men's & Children's Clothing And Footwear” — HTTP 200

## Superdry

- https://www.superdry.com/ — “Superdry UK: 15% Off Your First Order | Men's & Women's Clothing” — HTTP 200
- https://www.superdry.com/help-centre.html — “Customer Service” — HTTP 200

## Urban Outfitters

- https://www.urbanoutfitters.com/en-gb/ — “urbanoutfitters.com” — **unreadable: blocked by the site**

## Monsoon

- https://www.monsoon.co.uk/ — “Welcome to Monsoon UK | Women's and Kid's Clothing and Accessories” — HTTP 200
- https://help.monsoon.co.uk/hc/en-gb/categories/115000027671-Returns-Refunds — “Refunds & Returns – Monsoon Help Centre” — HTTP 200
- https://help.monsoon.co.uk/hc/en-gb/sections/115000044211-UK-and-ROI-Returns — “UK and ROI Returns – Monsoon Help Centre” — HTTP 200
- https://help.monsoon.co.uk/hc/en-gb/articles/115002860069-What-is-your-Returns-and-Cancellation-Policy — “What is your Returns and Cancellation Policy? – Monsoon Help Centre” — HTTP 200
  - > You have the right to cancel orders made on our website within 14 calendar days of receiving your goods. _(counts from delivery)_
  - > Once you’ve registered your return, you have a further 14 days to return the item(s) to us.
  - > That statutory cancellation and return period is 28 days in total our policy gives you 30 days to return your items after receipt.
  - > We will refund the full purchase price, including standard delivery charges for full orders returned, within 14 days of receiving the returned goods or proof of return. _(counts from delivery)_
  - > Refunds can take up to 10 days to be processed from the day it is received back to us. _(counts from delivery)_
  - > If you have paid with a credit or debit card or Apple Pay your refund will show back on your account within 10 working days, depending on whom you bank with.
  - > Paypal, ClearPay and Klarna can take up to 10 days to reflect any refunds and, where applicable, make any adjustments to your balance.
  - > If you have purchased in store you have 30 days to return any full price or sale item. _(in store, counts from purchase)_
- https://help.monsoon.co.uk/hc/en-gb/articles/4416974360977-How-do-I-return-a-UK-ROI-or-US-order — “Just a moment...” — **unreadable: blocked by the site**

## Reiss

- https://www.reiss.com/ — “Reiss UK - Womenswear, Menswear, & Accessories” — HTTP 200
- https://help.reiss.com/hc/en-gb — “Just a moment...” — **unreadable: blocked by the site**
- https://www.reiss.com/help/returns — “Just a moment...” — **unreadable: blocked by the site**

## AllSaints

- https://www.allsaints.com/ — “ALLSAINTS Official Site: Menswear, Womenswear & Accessories” — HTTP 200
- https://www.allsaints.com/returns-portal.html — “Returns Portal | Start your Return | ALLSAINTS” — HTTP 200
  - > You can return items purchased on the AllSaints website up to 28 days after purchase. _(counts from purchase)_
  - > You can return or exchange items purchased in an AllSaints store up to 28 days after purchase. _(counts from purchase)_
  - > AllSaints offers free returns on online orders, with a 28-day return window from the date you receive your items. _(online, counts from delivery)_
- https://www.allsaints.com/helpcenter/returns-faq.html — “Returns - AllSaints Help Center | ALLSAINTS” — HTTP 200

## Office

- https://www.office.co.uk/ — “OFFICE” — **unreadable: blocked by the site**

## Footasylum

- https://www.footasylum.com/ — “Footasylum | Down for Maintenance” — **unreadable: blocked by the site**

## Nike

- https://www.nike.com/gb/ — “Nike. Just Do It. Nike UK” — HTTP 200
- https://www.nike.com/gb/help/a/returns-policy — “What is Nike's returns policy? | Nike Help” — HTTP 200
  - > You can return or exchange most Nike items within 30 days of an online order delivery or Nike store purchase. _(online, counts from delivery)_
  - > For online purchases, this 30-day period includes your statutory 14-day right of withdrawal and grants an additional contractual return period of 16 days (under certain conditions). _(online)_
  - > You can exercise your right of withdrawal within the first 14 days of an online order delivery using our returns process—please see our returns instructions for additional information. _(online, counts from delivery)_

## Adidas

- https://www.adidas.co.uk/ — “adidas” — **unreadable: blocked by the site**

## Lululemon

- https://www.lululemon.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**

## AO

- https://ao.com/ — “Just a moment...” — **unreadable: blocked by the site**

## Samsung

- https://www.samsung.com/uk/ — “Samsung UK | Mobile | Home Electronics | Home Appliances | TV” — HTTP 200

## Richer Sounds

- https://www.richersounds.com/ — “Richer Sounds | TVs, Hi-Fi, Home Cinema” — HTTP 200
- https://customerservice.richersounds.com/hc/en-gb/sections/360003795198-Returns-Exchanges-and-Refunds — “Just a moment...” — **unreadable: blocked by the site**

## CeX

- https://uk.webuy.com/ — “CeX (UK) Buy & Sell Games, Phones, DVDs, Blu-ray, Electronics, Computing, Vision & CDs” — HTTP 200

## GAME

- https://www.game.co.uk/ — **unreadable: HTTP 502**

## Smyths

- https://www.smythstoys.com/uk/en-gb — **unreadable: blocked by the site**

## The Entertainer

- https://www.thetoyshop.com/ — “Access Denied” — **unreadable: blocked by the site**

## Hamleys

- https://www.hamleys.com/ — “Attention Required! | Cloudflare” — **unreadable: blocked by the site**

## Dyson

- https://www.dyson.co.uk/en — “Dyson UK | Official Site” — HTTP 200
  - > 35-day returns policy, Restrictions Apply
  - > We offer a 35-day returns policy for sealed products.​​
  - > We offer a 14-day returns policy on our oral care formulations:​
  - > We offer a 35-day returns policy, in case you change your mind (on floorcare, hair care and lighting).
  - > You may cancel up to 35 days after receiving your machine. _(counts from delivery)_
  - > Please note we offer a 14-day returns policy, in case you change your mind (on purifiers, fans, heaters, cosmetic products and cleaning solutions).
  - > You may cancel up to 14 days after receiving your machine. _(counts from delivery)_
- https://www.dyson.co.uk/inside-dyson/terms/return-and-cancel-your-order — “Attention Required! | Cloudflare” — **unreadable: blocked by the site**
- https://www.dyson.co.uk/inside-dyson/terms/organize-your-return — “Attention Required! | Cloudflare” — **unreadable: blocked by the site**

## Dunelm

- https://www.dunelm.com/ — “Dunelm | The UK's Leading Home Furnishings Retailer” — HTTP 200
- https://www.dunelm.com/info/help/returns-and-refunds — “Returns, Refunds & Exchanges | Dunelm” — HTTP 200
  - > If you decide it isn’t right for you, you can return or exchange unwanted items within 28 days of purchase* under our Change of Mind policy. _(counts from purchase)_
  - > Allow 7-10 working days for your refund to be issued to your original payment method
  - > Allow 7-10 working days for your refund to be processed to your original payment method
  - > Klarna – The refund will be issued to Klarna within 3-5 working days of the item arriving with us.
  - > PayPal – The refund will be issued to PayPal within 3-5 working days of the item arriving with us.
  - > Creation – Credit - The refund will be issued to Creation Finance within 3-5 working days of the item arriving with us.
  - > Creation Finance will apply the refund to your account within 5-10 working days.
  - > If your sofa, mattress or furniture item is deemed to be faulty within 30 days of receipt, where possible we will offer for the item to be repaired or replaced, however you are also able to reject the item and receive a full refund. _(counts from delivery)_
  - > We can exchange an item up to 28 days after purchase* if it meets the conditions of our returns policy listed above. _(counts from purchase)_
- https://www.dunelm.com/category/home-and-furniture/returns-outlet — “Returns Outlet | Dunelm” — HTTP 200
- https://www.dunelm.com/info/help/returns-policy — “Returns Policy - Online & Shop Returns Policy | Dunelm” — HTTP 200
  - > This allows you to return products (subject to exclusions) within 28 days of purchase if you change your mind. _(counts from purchase)_
  - > Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, if you buy goods from us online or by phone, your consumer rights entitle you to cancel your order and obtain a full refund if you request one from the moment you place your order until 14 days from the day of delivery of the goods (or if your order contains a number of items that are delivered separately, from receipt of the last item). _(online, counts from delivery)_
  - > If a fault develops within 30 days of purchase or delivery, as applicable, please return the item with proof of purchase (Dunelm issued proof of purchase or other proof of purchase such as a bank statement) and we’ll happily replace or refund it. _(counts from delivery)_
  - > We hope you’re happy with your Dunelm purchase, however, if you decide it isn’t right for you, you can return or exchange unwanted items within 28 days of purchase. _(counts from purchase)_
  - > To return an item where you’ve changed your mind (after the statutory 14 day cancellation period if that applies to your purchase) you must: _(counts from purchase)_
  - > Delivery charges for products will only be refunded where the whole order is damaged or faulty (or where the statutory 14 day cancellation period applies) – see Statutory Rights section for more information. _(counts from delivery)_
  - > We can exchange an item up to 28 days after purchase* if it meets the conditions of our Change of Mind policy listed above. _(counts from purchase)_
  - > Allow 7-10 working days for your refund to be issued to your original payment method
  - > Allow 7-10 working days for your refund to be processed to your original payment method
  - > If your sofa, mattress or furniture item is deemed to be faulty within 30 days of receipt, where possible we will offer for the item to be repaired or replaced, however, in accordance with your statutory rights you are also able to reject the item and receive a full refund. _(counts from delivery)_
  - > Klarna – The refund will be issued to Klarna within 3-5 working days of the item arriving with us.
  - > PayPal – The refund will be issued to PayPal within 3-5 working days of the item arriving with us.
  - > Creation – Credit - The refund will be issued to Creation Finance within 3-5 working days of the item arriving with us.
  - > Creation Finance will apply the refund to your account within 5-10 working days.

## The Range

- https://www.therange.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**

## B&M

- https://www.bmstores.co.uk/ — “B&M | Discount Retail Store | Garden, Home, Toys & More” — HTTP 200
- https://www.bmstores.co.uk/returns-policy — “B&M Stores Returns Policy” — HTTP 200
  - > If you are not happy with a purchase you make at one of our stores, simply return the product in its original condition with proof of purchase within 30 days and we’ll give you a full refund or replacement. _(counts from purchase)_
  - > However, if the product is faulty, you may return it with your receipt within 30 days for an exchange of the same title
  - > Electrical Goods: Customers have 12 months from the date of purchase to return any faulty electrical items, provided proof of purchase is available. _(counts from purchase)_

## Homebase

- https://www.homebase.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**

## Toolstation

- https://www.toolstation.com/ — “Toolstation | Low prices on 25,000+ trade quality products” — HTTP 200
- https://www.toolstation.com/returns — “Returns Information | Toolstation” — HTTP 200
  - > But if you do, we want to make the process quick and easy with our 30-Day Money Back Guarantee – so you can exchange or refund your purchase with confidence. _(counts from purchase)_
  - > 30-Day Money Back GuaranteeHow To Return An ItemExcluded ItemsItems Delivered Direct From SupplierOur Repairs ProcessHow To Cancel An OrderOur Refund ProcessFAQs _(counts from delivery)_
  - > Need to return an item to us? We offer a 30-Day Money Back Guarantee on most products to give you complete peace of mind – you can return a faulty or unwanted, unused item for an exchange or full refund, providing it’s within 30 days of receipt.
  - > Some other items are also exempt and cannot be returned to stores under our 30-Day Money Back Guarantee policy.
  - > You can still return this product within 30 days.
  - > Refunds will be processed within 14 days of the returned item being collected, and made to the original method of payment. _(counts from delivery)_
  - > Refunds to debit and credit cards can take 3-5 working days.
  - > Refunds to PayPal can take 5-10 working days.
  - > Items collected directly by the supplier will be refunded within 14 days. _(counts from delivery)_
  - > If your item is faulty and was purchased less than 30 days ago, take it to your nearest store with its original packaging for an exchange or refund – remember to bring your receipt, invoice or order reference number too. _(counts from purchase)_
  - > You can return an item if it’s not faulty – provided it’s within 30 days of purchase (from a store) or within 30 days of delivery (from online orders). _(online, counts from delivery)_

## Habitat

- https://www.habitat.co.uk/ — “Habitat | Sofas, furniture, lighting & home accessories.” — HTTP 200
- https://www.habitat.co.uk/order/tracking?type=returns&clickOrigin=header:home:returns — “Track your order” — HTTP 200
- https://www.habitat.co.uk/order/tracking?type=returns — “Track your order” — HTTP 200
- https://www.habitat.co.uk/help/returns-and-refunds — “Habitat returns guide | Habitat” — HTTP 200
  - > If you've changed your mind and wish to return an item, you have 30 days from the date of collection or from the date of delivery to request to return your item(s). _(counts from delivery)_
  - > Once returned, please allow 14 days to be refunded.
  - > Refunds will be processed within 14 days of receiving the item(s). _(counts from delivery)_
  - > If you make a purchase from us online or by phone as a consumer – including for Click and Collect – you have the legal right to cancel your contract within 14 calendar days, starting the day after you receive your order, without giving any reason. _(online, counts from delivery)_
  - > Refunds will be issued within 14 days after the day on which we receive the goods back, or (if earlier) the day on which you supply evidence of having sent the goods back. _(counts from delivery)_
  - > If we offer to collect the goods, you will receive your refund within 14 days after the day you inform us of your decision to cancel the contract (less any applicable collection charges described above / below). _(counts from delivery)_

## DFS

- https://www.dfs.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**

## Furniture Village

- https://www.furniturevillage.co.uk/ — “The UK's Largest Independent Furniture Retailer - Furniture Village” — HTTP 200
- https://www.furniturevillage.co.uk/help-and-advice/returns-and-cancellations.html — “Returns and cancellations - Furniture Village” — HTTP 200

## Oak Furnitureland

- https://www.oakfurnitureland.co.uk/ — “Oak Furniture and Sofas | Oak Furnitureland” — HTTP 200
- https://www.oakfurnitureland.co.uk/page/returns-policy.html — “Returns and Cancellations Policy | Oak Furnitureland” — HTTP 200
  - > If you need to cancel your order before delivery for any reason, please let us know at least 3 working days before your delivery date. _(counts from delivery)_

## Wayfair

- https://www.wayfair.co.uk/ — “Access to this page has been denied” — **unreadable: blocked by the site**

## Lakeland

- https://www.lakeland.co.uk/ — “Lakeland | Cookware, Bakeware, Cleaning & Laundry” — HTTP 200
- https://www.lakeland.co.uk/policies/refund-policy — “Refund policy – Lakeland” — HTTP 200

## Robert Dyas

- https://www.robertdyas.co.uk/ — “Robert Dyas | Garden, DIY, Electricals & Homewares | Robert Dyas” — HTTP 200
- https://www.robertdyas.co.uk/returns — “Returns | Robert Dyas” — HTTP 200
  - > Your refund will then be processed to the original payment method within 3-5 working days, or 24-48 hours if paid via PayPal.
  - > Once you have returned your online goods to a Robert Dyas store your return will be processed within 48 hours and your refund will then be processed to the original payment method within 3-5 working days, or 24-48 hours if paid via PayPal. _(online)_
  - > If any product you purchase develops a fault within 30 days, we will offer an exchange, refund or repair as appropriate, in accordance with your legal rights. _(counts from purchase)_
  - > Where a repair or replacement isn't possible, we'll issue you a full refund, or after 6 months we reserve the right to issue a partial refund.

## Hobbycraft

- https://www.hobbycraft.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**

## The Works

- https://www.theworks.co.uk/ — “The Works | Affordable Screen-Free Fun for the Whole Family” — HTTP 200

## Superdrug

- https://www.superdrug.com/ — “Access Denied” — **unreadable: blocked by the site**

## Lush

- https://www.lush.com/uk/en — “Just a moment...” — **unreadable: blocked by the site**

## The Body Shop

- https://www.thebodyshop.com/ — “Nature Inspired Skincare, Body & Beauty Products | The Body Shop” — HTTP 200
- https://www.thebodyshop.com/blogs/about-us/delivery-returns — “Delivery & Returns – The Body Shop” — HTTP 200
  - > We'd love the chance to recommend to you an alternative Product or your money-back guarantee means you can return any product (subject to the exceptions mentioned in section 8.5 of our Terms and Conditions of Sale) within 45 days of the date we deliver the relevant Product, with your receipt).

## Space NK

- https://www.spacenk.com/uk/home — “Space NK | Luxury Beauty | 15% Off First Order” — HTTP 200
- https://help.spacenk.com/hc/en-us/sections/360000443013-Returns — “Just a moment...” — **unreadable: blocked by the site**

## Lookfantastic

- https://www.lookfantastic.com/ — “LOOKFANTASTIC - Beauty, Fragrances, Skincare & Haircare” — HTTP 200
- https://www.lookfantastic.com/c/info/refunds-returns/ — “LOOKFANTASTIC Refunds & Returns” — HTTP 200
  - > This can take 3-5 working days from the date we receive the return. _(counts from delivery)_
  - > *Eligible returns are in pristine condition and requested within 30 days of receipt.
  - > You have 30 days from the date of receiving your item to start a return. _(counts from delivery)_
  - > This can take 7 working days from the date we receive the return. _(counts from delivery)_
  - > Your refund should be returned to your account within 5 working days and we’ll send you an email to let you know it's on its way!
  - > If you don't receive your refund and it's been 10 working days since you received our email, then you'll need to contact our Customer Service team through your account. _(counts from delivery)_

## Sephora

- https://www.sephora.co.uk/ — “Access Denied” — **unreadable: blocked by the site**

## Holland & Barrett

- https://www.hollandandbarrett.com/ — “Holland & Barrett - UK's Leading Health & Wellness Shop” — HTTP 200
- https://www.hollandandbarrett.com/info/delivery-and-returns/returns/ — “Our Returns & Refunds Policy | Info | Holland & Barrett” — HTTP 200
  - > You can return any unused item within 30 days of your original purchase date for an exchange or refund, so long as it is unopened, unused, in a saleable condition and the seals remain intact. _(counts from purchase)_
  - > After handing your return to the delivery courier, please allow up to 14 days for it to reach us and be processed. _(counts from delivery)_
  - > The same 30-day return eligibility rules apply to these items.
  - > Please allow 5 working days for your refund.
- https://www.hollandandbarrett.com/info/delivery-and-returns/home-delivery/ — “Home Delivery | Customer Service | H&B” — HTTP 200
- https://www.hollandandbarrett.com/info/delivery-and-returns/click-collect/ — “Click & Collect | Customer Service | H&B” — HTTP 200
  - > If you do not collect your C&C order within 7 days, it will be cancelled, and refunded.

## Waterstones

- https://www.waterstones.com/ — “Just a moment...” — **unreadable: blocked by the site**

## WHSmith

- https://www.whsmith.co.uk/ — **unreadable: HTTP 502**

## Ryman

- https://www.ryman.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**

## Mountain Warehouse

- https://www.mountainwarehouse.com/ — “Mountain Warehouse - Outdoor Clothing & Equipment” — HTTP 200
  - > HASSLE FREE 60 Day Returns
- https://www.mountainwarehouse.com/help-centre/ — “Home” — HTTP 200
  - > HASSLE FREE 60 Day Returns

## Go Outdoors

- https://www.gooutdoors.co.uk/ — “GO Outdoors | Camping | Outdoor Clothing | Sale” — HTTP 200
- https://www.gooutdoors.co.uk/policies/refund-policy — “Returns and Refunds – GO Outdoors” — HTTP 200
  - > You may also make a Return to any of our stores within 28 days, please see below for details.
  - > Should you change your mind we offer a refund within 28 days of delivery or collection using the returns portal link above, or to a store. _(counts from delivery)_
  - > You have 14 days from delivery (rather than the normal 28) to return any refurbished item you purchase online. _(online, counts from delivery)_
  - > Beyond 14 days, we will only accept returns for faulty goods.
  - > If an entire order is cancelled within the 14 day cancellation period then the standard delivery charge will be refunded. _(counts from delivery)_

## Cotswold Outdoor

- https://www.cotswoldoutdoor.com/ — “Outdoor Clothing & Equipment | Cotswold Outdoor” — HTTP 200

## Halfords

- https://www.halfords.com/ — “Access Denied” — **unreadable: blocked by the site**

## Pets at Home

- https://www.petsathome.com/ — “Pets at Home | Pet Shop | The UK's Leader In Pet Care” — HTTP 200
- https://www.petsathome.com/support/refund-and-returns — “Pets at Home Support, Refunds and Returns | Pets” — HTTP 200
  - > If you change your mind, you can return it within 30 days with proof of purchase. _(counts from purchase)_
  - > Refunds are typically processed by your card-issuing bank within 3-5 working days after we initiate the refund.
  - > If you have purchased your goods online, our 30 day returns policy is in addition to your statutory rights, which allow you to return goods purchases made online within 14 days beginning the day after you receive the goods. _(online, counts from delivery)_
  - > If you are returning defective goods, you have the statutory right to a refund or replacement if you let us know within 30 days beginning the day after you receive the goods. _(counts from delivery)_
  - > If you are returning goods due to a defect, you have the statutory right to a refund or replacement if you let us know within 30 days beginning the day after you receive the goods. _(counts from delivery)_

## JoJo Maman Bébé

- https://www.jojomamanbebe.co.uk/ — “JoJo Maman Bébé | Baby, Kids, Maternity, Equipment & Toys” — HTTP 200
- https://www.jojomamanbebe.co.uk/terms — “Terms & Conditions | JoJo Maman Bébé” — HTTP 200
  - > Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, if you are contracting with us as a consumer online or by phone, you have the right to cancel your contract at any time up to 14 days after the day on which you receive the goods you ordered. _(online, counts from delivery)_
  - > You must inform us of your wish to cancel in writing either by letter, email or by using the cancellation form on the website or call 0333 777 4529 within a period of 14 days beginning on the day after the day you receive your goods. _(counts from delivery)_
  - > You must return goods in their original packaging, wherever possible, within 14 days of informing us of your wish to cancel.
  - > Orders delivered to stores that are not collected within 10 days of the collection date will be returned to the warehouse and a refund processed. _(counts from delivery)_
  - > In the event the referred customer orders are placed and cancelled, or refunded in full, within 14 days of placing their order, the referring customer will not be entitled to their offer.
  - > Refunds are normally processed within 5-days of receipt of goods at our warehouse. _(counts from delivery)_
