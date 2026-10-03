# Candidate retailers, read from their own sites — 2026-10-03

Written by `npm run check:retailers -- --candidates`. Each shop's listed returns page was read; where none was listed, or it stated no period, the homepage was opened and the shop's own Returns/Refunds links followed. The periods column counts how often each number appears in a sentence about returns: a summary to read the quotes against, never a value to copy. A shop goes into `stores.ts` by hand, from the quotes, with its returns page added to `retailer-sources.json` in the same change.

| Shop | Status | Periods named | Clock named |
|---|---|---|---|
| Asda | read | 14 days ×5, 100 days ×2, 5 days ×1 | delivery |
| Morrisons | read | 14 days ×2, 30 days ×1 | delivery |
| Waitrose | unreadable: HTTP 502 | — | — |
| Aldi | read | 60 days ×1 | — |
| Selfridges | read | 14 days ×3 | purchase, delivery |
| Harrods | unreadable: blocked by the site | — | — |
| Liberty | read | 30 days ×5, 14 days ×4 | delivery, purchase |
| House of Fraser | unreadable: HTTP 502; blocked by the site | — | — |
| Primark | no window found | — | — |
| New Look | read | 14 days ×3, 28 days ×2, 5 days ×1 | purchase, delivery |
| TK Maxx | unreadable: blocked by the site | — | — |
| Mango | unreadable: blocked by the site | — | — |
| Shein | read | 14 days ×1 | — |
| Very | unreadable: blocked by the site | — | — |
| JD Sports | no returns link found | — | — |
| Schuh | unreadable: blocked by the site | — | — |
| FatFace | read | 14 days ×3, 28 days ×2, 5 days ×1, 10 days ×1, 15 days ×1 | delivery |
| Joules | read | 28 days ×1 | — |
| Superdry | no window found | — | — |
| Urban Outfitters | unreadable: blocked by the site | — | — |
| Reiss | read | 14 days ×1, 28 days ×1 | purchase |
| Office | unreadable: blocked by the site | — | — |
| Footasylum | unreadable: blocked by the site; HTTP 502 | — | — |
| Adidas | unreadable: HTTP 502; blocked by the site | — | — |
| Lululemon | unreadable: blocked by the site | — | — |
| AO | unreadable: blocked by the site | — | — |
| Samsung | read | 14 days ×11, 30 days ×1 | delivery |
| Richer Sounds | read | 14 days ×4, 30 days ×4, 5 days ×1 | purchase, delivery |
| CeX | read | 14 days ×2 | delivery |
| GAME | unreadable: HTTP 502; blocked by the site | — | — |
| Smyths | unreadable: blocked by the site | — | — |
| The Entertainer | unreadable: blocked by the site; page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://ask.thetoyshop.com/help/returns | — | — |
| Hamleys | unreadable: blocked by the site | — | — |
| Dyson | read | 35 days ×4, 14 days ×3 | delivery |
| The Range | unreadable: blocked by the site | — | — |
| Homebase | unreadable: blocked by the site; page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.homebase.co.uk/hc/en-gb/articles/30405319631505-Can-I-return-my-online-order-for-a-refund; page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.homebase.co.uk/hc/en-gb/articles/30055728344081-Can-I-return-my-items-purchased-from-a-store | — | — |
| DFS | unreadable: blocked by the site | — | — |
| Furniture Village | no window found | — | — |
| Oak Furnitureland | read | 3 days ×1 | delivery |
| Wayfair | unreadable: blocked by the site | — | — |
| Lakeland | no window found | — | — |
| Robert Dyas | read | 5 days ×2, 30 days ×1 | purchase |
| Hobbycraft | unreadable: blocked by the site | — | — |
| The Works | read | 28 days ×3, 365 days ×1 | delivery |
| Superdrug | unreadable: blocked by the site | — | — |
| Lush | read | 14 days ×1 | delivery |
| Space NK | read | 14 days ×1 | delivery |
| Sephora | unreadable: blocked by the site | — | — |
| Waterstones | unreadable: blocked by the site | — | — |
| WHSmith | unreadable: HTTP 502 | — | — |
| Ryman | unreadable: blocked by the site | — | — |
| Mountain Warehouse | read | 60 days ×1 | — |
| Cotswold Outdoor | no returns link found | — | — |
| Halfords | unreadable: blocked by the site | — | — |
| JoJo Maman Bébé | read | 14 days ×4, 5 days ×1, 10 days ×1 | delivery |

## Asda

- https://direct.asda.com/george/GRG_INFO_RETURNS,default,pg.html — “Clothing Returns & Refunds Policy | Free Returns | George.com” — HTTP 200
  - > Refund within 14 working days
  - > Return within 100 days
  - > Faster refunds (3-5 days)
  - > Standard refunds (up to 14 days)
  - > If you don't return via a Faster Refund store, your refund can take up to 14 days to be completed.
  - > If you're not 100% satisfied with your George item purchased through the George website, you can return most items within 100 days after delivery or collection. _(counts from delivery)_
  - > If returned within 14 days, you will also be eligible to receive a _(counts from delivery)_
  - > Refunds typically take 3-14 days, depending on the return method.

## Morrisons

- https://www.morrisons.com/help/online-shopping/payments/refunds — “Morrisons - Welcome to your Morrisons Help Hub” — HTTP 200
- https://groceries.morrisons.com/content/terms-and-conditions — “Terms & Conditions - Morrisons online supermarket” — HTTP 200
  - > cancellation form which can be found here and email it to customerservice@morrisonsplc.co.uk within 14 days from
  - > Products cancelled in accordance with Condition 9.3 must be returned to us within 30 days of notifying us of the
  - > cancellation, following which will process the refund due to you within 14 days from the date we receive the _(counts from delivery)_

## Waitrose

- https://www.waitrose.com/ — **unreadable: HTTP 502**
- https://www.waitrose.com/ecom/help-information/customer-service/shoppingonline/refunds---returns — **unreadable: HTTP 502**

## Aldi

- https://help.aldi.co.uk/faqs/article/Can-I-return-things-I-buy-in-your-stores — “Can I return things I buy in your stores? I Customer Support ALDI” — HTTP 200
  - > With our 60-day return policy you can bring anything back for a refund as long as it’s:

## Selfridges

- https://www.selfridges.com/GB/en/info/returns/ — “Returns | Selfridges” — HTTP 200
  - > Store purchases can be returned to any of our four stores within 14 days of your purchase. _(counts from purchase)_
  - > If you ordered the item online, just fill in your returns form (so that we can identify your order) and visit returns.selfridges.com within 14 days of delivery or collection to arrange a collection or request a return by post, and you’ll then have a further 14 days to return the item. _(online, counts from delivery)_
  - > Items purchased in store at a reduced in price for sale or clearance may be returned within 14 days for an exchange or gift card only. _(in store, counts from purchase)_
- https://www.selfridges.com/GB/en/info/returns/returns-exceptions/ — “Attention Required! | Cloudflare” — **unreadable: blocked by the site**

## Harrods

- https://www.harrods.com/en-gb/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.harrods.com/en-gb/c/faqs/returns — “Access Denied” — **unreadable: blocked by the site**

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
- https://help.houseoffraser.co.uk/support/solutions/articles/80001157126-i-need-to-return-an-item-bought-online — “Just a moment...” — **unreadable: blocked by the site**
- https://help.houseoffraser.co.uk/support/solutions/articles/80001157127-i-need-to-return-my-order-or-item-bought-in-store — “Just a moment...” — **unreadable: blocked by the site**

## Primark

- https://www.primark.com/en-gb — “Planned maintenance” — **unreadable: blocked by the site**
- https://www.help.primark.com/auth/v3/signin?brand_id=819529&locale=en-gb&return_to=https%3A%2F%2Fwww.help.primark.com%2Fhc%2Fen-gb%2Farticles%2F115005690845-Refunds-and-Returns-Policy&role=end_user — “Sign in to Primark” — HTTP 200

## New Look

- https://help-uk.newlook.com/hc/en-gb/articles/360015244592-What-is-your-returns-policy — “What is your returns policy? – Help Centre Home” — HTTP 200
  - > You can return your item within 28 days, including items purchased with promotional discounts. _(counts from purchase)_
  - > Notify us within 14 days of receiving your order, you then have another 14 days to return the items to us. _(counts from delivery)_
  - > After you drop your return off, we’ll process it within 14 calendar days.
  - > Once processed, please allow 3–5 working days for your refund to show on your original payment method.
  - > For sale items purchased in store you can return them within 14 days of purchase, with a valid receipt, for an exchange only. _(in store, counts from purchase)_
- https://help-uk.newlook.com/hc/en-gb/articles/14434647950237-What-is-your-in-store-returns-policy — “What is your in-store returns policy? – Help Centre Home” — HTTP 200
  - > To obtain a refund or exchange you’ll need your receipt and item(s) must be returned within 28 days of purchase – items must be unworn and in their original condition. _(counts from purchase)_

## TK Maxx

- https://www.tkmaxx.com/uk/en/ — “TKMaxx.com: Something went wrong” — **unreadable: blocked by the site**
- https://www.tkmaxx.com/uk/en/l/customer-service/returns+refunds — “TKMaxx.com: Something went wrong” — **unreadable: blocked by the site**

## Mango

- https://shop.mango.com/gb — “Vercel Security Checkpoint” — **unreadable: blocked by the site**
- https://shop.mango.com/gb/en/help/returns/return-conditions — “Vercel Security Checkpoint” — **unreadable: blocked by the site**
- https://shop.mango.com/gb/en/help/returns/online-returns — “Vercel Security Checkpoint” — **unreadable: blocked by the site**

## Shein

- https://www.shein.co.uk/Return-Policy-a-281.html — “SHEIN Return Policy | SHEIN UK” — HTTP 200
  - > This product is returnable within 14 days withdrawal right return period but not in the extended commercial return period

## Very

- https://www.very.co.uk/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.very.co.uk/returns-help.page — “Access Denied” — **unreadable: blocked by the site**
- https://www.very.co.uk/help/en/online-help-system/help_returns — “Access Denied” — **unreadable: blocked by the site**

## JD Sports

- https://www.jdsports.co.uk/ — “JD Sports UK - Forever Forward” — HTTP 200
- https://www.jdsports.co.uk/pages/faqs/returns-and-refunds/what-is-your-returns-policy/ — **unreadable: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at https://www.jdsports.co.uk/pages/faqs/returns-and-refunds/what-is-your-returns-policy/**
- https://www.jdsports.co.uk/page/delivery-returns/ — **unreadable: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at https://www.jdsports.co.uk/page/delivery-returns/**

## Schuh

- https://www.schuh.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.schuh.co.uk/help/returns/ — “Just a moment...” — **unreadable: blocked by the site**

## FatFace

- https://www.fatface.com/terms — “Next Terms & Conditions | T&C's | Next Official Site” — HTTP 200
  - > Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, if you are contracting with us as a consumer online or by phone, you have the right to at any time up to 14 days after the day on which you received the goods you ordered. _(online, counts from delivery)_
  - > You should return goods to us in their original packaging, wherever possible, within 14 days of informing us of your wish to cancel.
  - > Orders delivered to stores that are not collected within 10 days of the collection date will be returned to the warehouse and a refund processed. _(counts from delivery)_
  - > If you want to return your order you must do so within 28 days from the day the goods were delivered to either (1) your home address; or (2) a store (if you elected for your items to be delivered to store). _(counts from delivery)_
  - > Please note this returns period is 14 days longer than the consumer law right of cancellation.
  - > Purchases made from 25th December 2025 are subject to our standard 28 day returns policy (15 days for sale).
  - > Refunds are normally processed within 5-days of receipt of goods at our warehouse. _(counts from delivery)_

## Joules

- https://joulesuk.zendesk.com/hc/en-gb/sections/17676403528721-Returns — “Returns – Joules” — HTTP 200
- https://joulesuk.zendesk.com/hc/en-gb/articles/17703533708561-How-do-I-return-an-online-order — “How do I return an online order? – Joules” — HTTP 200
  - > You can return your unwanted items (full price or Sale) following the instructions below, within 28 days of receipt, unused and in their original condition.

## Superdry

- https://www.superdry.com/ — “Superdry UK: 15% Off Your First Order | Men's & Women's Clothing” — HTTP 200
- https://help.superdry.com/Returns/Returns-Policy/1660038622/What-is-your-return-policy.htm — **unreadable: page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.superdry.com/Returns/Returns-Policy/1660038622/What-is-your-return-policy.htm**
- https://www.superdry.com/help-centre.html — “Customer Service” — HTTP 200

## Urban Outfitters

- https://www.urbanoutfitters.com/en-gb/ — “urbanoutfitters.com” — **unreadable: blocked by the site**
- https://www.urbanoutfitters.com/en-gb/help/return-policy — “urbanoutfitters.com” — **unreadable: blocked by the site**

## Reiss

- https://help.reiss.com/hc/en-gb/articles/4411046702609-Our-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**
- https://help.reiss.com/hc/en-gb/articles/4429050436881-Returning-Store-Purchases — “Returning Store Purchases – REISS Help Centre” — HTTP 200
  - > If you want to return any in-store purchases you must do so within 28 days from the day the goods were purchased. _(in store, counts from purchase)_
  - > Please note this returns period is 14 days longer than the consumer law right of cancellation.

## Office

- https://www.office.co.uk/ — “OFFICE” — **unreadable: blocked by the site**
- https://www.office.co.uk/view/content/returnsinfo-page — “OFFICE” — **unreadable: blocked by the site**

## Footasylum

- https://www.footasylum.com/ — “Footasylum | Down for Maintenance” — **unreadable: blocked by the site**
- https://support.footasylum.com/hc/en-us/articles/201616331-How-do-I-return-my-order-for-an-exchange-or-a-refund- — **unreadable: HTTP 502**
- https://support.footasylum.com/hc/en-us/articles/201616431-What-is-your-Store-Returns-Policy- — **unreadable: HTTP 502**

## Adidas

- https://www.adidas.co.uk/ — **unreadable: HTTP 502**
- https://www.adidas.co.uk/help/return.html — “adidas” — **unreadable: blocked by the site**

## Lululemon

- https://www.lululemon.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.lululemon.co.uk/en-gb/returns-policy-and-refunds/returnspolicyandrefunds.html — “Just a moment...” — **unreadable: blocked by the site**

## AO

- https://ao.com/ — “Just a moment...” — **unreadable: blocked by the site**
- https://ao.com/help-and-advice/delivery-and-services/returns — “Just a moment...” — **unreadable: blocked by the site**

## Samsung

- https://www.samsung.com/uk/shop-faq/returns-and-cancellations/what-is-the-returns-period/ — “What is the returns policy? | Samsung UK” — HTTP 200
  - > We will be happy to accept a return, and offer an exchange or a refund, as long as you notify us within 14 days of the day you receive your product(s), unless otherwise stated as part of a promotion. _(counts from delivery)_
  - > You will then have a further 14 days from notification to return the product(s) to us.
  - > All returns can take up to 14 days to process.
  - > If you have not received confirmation of your return after 14 days, please _(counts from delivery)_
  - > If you ordered a phone with an inclusive network contract and SIM card, all items must be returned to us within 14 days.
  - > In cases where exceptional circumstances prevented you from returning your product(s) within 14 days, you can still return it, as long as you let us know during that time.
  - > If you believe your product is faulty, you have up to 30 days from delivery to notify our customer services team to confirm whether you require a repair, replacement or refund. _(counts from delivery)_
- https://www.samsung.com/uk/shop-faq/returns-and-cancellations/how-do-i-return-my-product-if-i-have-changed-my-mind/ — “How do I return my product if I have changed my mind? | Samsung UK” — HTTP 200
  - > The following conditions apply to all other returns unless explicitly stated: We will be happy to accept a return, and offer an exchange or refund, as long as you notify us within 14 days of the day you receive your product(s), unless otherwise stated as part of a promotion. _(counts from delivery)_
  - > You will then have a further 14 days from notification to return your product(s) to us.
  - > Please note: You must return goods without undue delay and in any event within 14 days of requesting a return.
  - > If you send us your item(s) after 14 days has passed, we reserve the right to refuse your return.
  - > All returns can take up to 14 days to process.
  - > If you have not received confirmation of your return after 14 days, please contact us. _(counts from delivery)_

## Richer Sounds

- https://customerservice.richersounds.com/hc/en-gb/articles/360012946177-Unwanted-items — “Unwanted items – Richer Sounds Online Customer Service” — HTTP 200
  - > We will happily refund or exchange your purchase price in full if for any reason you return your item/s to us in a ‘sealed’ (unopened / unused) condition within 30 days of purchase. _(counts from purchase)_
  - > Therefore, a 10% handling fee may be deducted if they are returned within 30 days of purchase in mint condition with all packaging / accessories (excludes earphones). _(counts from purchase)_
  - > a) After a 30 day period from the date of initial purchase you may incur a restocking fee on goods you wish to return or exchange for other goods and some cases, a refusal of refund. _(counts from purchase)_
  - > Unwanted goods should be returned within 30 days.
  - > Under the Consumer Contracts Regulations, you may return goods and obtain a full refund of the cost of the good/s you have ordered, provided you notify Richer Sounds of your intention to do so within 14 days of the date of receipt by you (in the case of a multiple order, within 14 days of receiving the last item). _(counts from delivery)_
  - > You will then have a further 14 days to return the goods from this notification date.
  - > We will aim to send you a full refund within 14 days of receiving the goods from you. _(counts from delivery)_
  - > We will send you a full refund within 14 days of receiving the goods from you, excluding any premium delivery charges and the £6.95, £14.95 or £29.95 collection fee if you have asked us to collect your item/s from you. _(counts from delivery)_
  - > Once your refund is processed it will appear in your account within 5 working days (a working day is Monday-Friday, excluding bank holidays).
- https://customerservice.richersounds.com/hc/en-gb/sections/360003795198-Returns-Exchanges-and-Refunds — “Returns, Exchanges and Refunds – Richer Sounds Online Customer Service” — HTTP 200

## CeX

- https://uk.support.webuy.com/support/solutions/articles/80001011699-returning-an-unwanted-online-order — “CeX (UK) : Contact CeX” — HTTP 200
  - > You will need to notify us within 14 days of your delivery of your wish to return the item, after which, you then have a further 14 days from notifying us to return the item, either to a store or by posting it back to us. _(counts from delivery)_
  - > You may also return any unwanted online order by taking it into any CeX store within 14 days of delivery for a full refund, without needing to notify us in advance. _(online, counts from delivery)_

## GAME

- https://www.game.co.uk/ — **unreadable: HTTP 502**
- https://helps.game.co.uk/en/support/solutions/articles/80000620493-game-returns-policy — **unreadable: HTTP 502**
- https://help.game.co.uk/support/solutions/articles/80001148308-delivery-and-returns — “Just a moment...” — **unreadable: blocked by the site**

## Smyths

- https://www.smythstoys.com/uk/en-gb — **unreadable: blocked by the site**
- https://www.smythstoys.com/uk/en-gb/returns — **unreadable: blocked by the site**

## The Entertainer

- https://www.thetoyshop.com/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.thetoyshop.com/returns — “Access Denied” — **unreadable: blocked by the site**
- https://ask.thetoyshop.com/help/returns — **unreadable: page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://ask.thetoyshop.com/help/returns**

## Hamleys

- https://www.hamleys.com/ — “Attention Required! | Cloudflare” — **unreadable: blocked by the site**
- https://www.hamleys.com/frequently-asked-questions — “Attention Required! | Cloudflare” — **unreadable: blocked by the site**

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

## The Range

- https://www.therange.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://help.therange.co.uk/hc/en-gb/articles/360015308140-What-is-your-returns-policy — “Just a moment...” — **unreadable: blocked by the site**
- https://www.therange.co.uk/returnsandrefunds/ — “Just a moment...” — **unreadable: blocked by the site**

## Homebase

- https://www.homebase.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://help.homebase.co.uk/hc/en-gb/articles/30405319631505-Can-I-return-my-online-order-for-a-refund — **unreadable: page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.homebase.co.uk/hc/en-gb/articles/30405319631505-Can-I-return-my-online-order-for-a-refund**
- https://help.homebase.co.uk/hc/en-gb/articles/30055728344081-Can-I-return-my-items-purchased-from-a-store — **unreadable: page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.homebase.co.uk/hc/en-gb/articles/30055728344081-Can-I-return-my-items-purchased-from-a-store**

## DFS

- https://www.dfs.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://help.dfs.co.uk/hc/en-gb/articles/4408189564689-Can-I-return-my-furniture — “Just a moment...” — **unreadable: blocked by the site**
- https://help.dfs.co.uk/hc/en-gb/articles/4408224278161-What-is-your-cancellation-policy — “Just a moment...” — **unreadable: blocked by the site**

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
- https://www.lakeland.co.uk/policies/shipping-policy — “Shipping policy – Lakeland” — HTTP 200
- https://www.lakeland.co.uk/pages/lakeland-guarantee — “Lakeland guarantee” — HTTP 200
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
- https://www.hobbycraft.co.uk/help-centre/customer-services/cp-returns-information.html — “Just a moment...” — **unreadable: blocked by the site**

## The Works

- https://www.theworks.co.uk/page/faq.html — “FAQs | The Works” — HTTP 200
  - > We'll be happy to offer a refund for goods returned with a valid receipt within 28 days of receiving them, as _(counts from delivery)_
  - > If you return goods within 28 days without a receipt, we can
  - > If your item is damaged or faulty, you have 12 months to return it to store for an
- https://www.theworks.co.uk/page/terms-conditions.html — “Terms & Conditions | The Works” — HTTP 200
  - > We will be happy to give a refund for any goods, on presentation of a valid receipt within 28 days of receiving the _(counts from delivery)_

## Superdrug

- https://www.superdrug.com/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.superdrug.com/returnPolicy — “Access Denied” — **unreadable: blocked by the site**

## Lush

- https://www.lush.com/uk/en/faq/returns-and-refunds — “Commerce Web - UK - Returns and Refunds | LUSH” — HTTP 200
  - > Where the products have already been delivered to you, we will process the refund due to you as soon as possible and, in any case, within 14 calendar days after the day on which we receive the returned products, or (if earlier) within 14 calendar days after the day you provide us with evidence that the products were returned to us. _(online, counts from delivery)_

## Space NK

- https://www.spacenk.com/uk/home — “Space NK | Luxury Beauty | 15% Off First Order” — HTTP 200
- https://help.spacenk.com/hc/en-us/articles/360002297754-Returns-Policy-Store-Online — “Just a moment...” — **unreadable: blocked by the site**
- https://help.spacenk.com/hc/en-us/sections/360000443013-Returns — “Returns & Refunds – SPACE.NK.apothecary” — HTTP 200
- https://help.spacenk.com/hc/en-us/categories/360000190773-Returns-Refunds — “Returns & Refunds – SPACE.NK.apothecary” — HTTP 200
- https://help.spacenk.com/hc/en-us/sections/360000443013-Returns-Refunds — “Returns & Refunds – SPACE.NK.apothecary” — HTTP 200
- https://help.spacenk.com/hc/en-us/articles/33022207294877-Returns-Processing-Times — “Returns Processing Times – SPACE.NK.apothecary” — HTTP 200
  - > Returns are currently being processed within 14 working days from the date we receive your product(s). _(counts from delivery)_

## Sephora

- https://www.sephora.co.uk/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.sephora.co.uk/terms-and-conditions/ — “Access Denied” — **unreadable: blocked by the site**

## Waterstones

- https://www.waterstones.com/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.waterstones.com/help/returning-items/41 — “Just a moment...” — **unreadable: blocked by the site**

## WHSmith

- https://www.whsmith.co.uk/ — **unreadable: HTTP 502**
- https://www.whsmith.co.uk/help/returns/ — **unreadable: HTTP 502**

## Ryman

- https://www.ryman.co.uk/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.ryman.co.uk/returns-policy — “Just a moment...” — **unreadable: blocked by the site**

## Mountain Warehouse

- https://www.mountainwarehouse.com/ — “Mountain Warehouse - Outdoor Clothing & Equipment” — HTTP 200
  - > HASSLE FREE 60 Day Returns
- https://www.mountainwarehouse.com/help-centre/ — “Home” — HTTP 200
  - > HASSLE FREE 60 Day Returns

## Cotswold Outdoor

- https://www.cotswoldoutdoor.com/ — “Outdoor Clothing & Equipment | Cotswold Outdoor” — HTTP 200
- https://help.cotswoldoutdoor.com/hc/en-gb/articles/4411467010834-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**

## Halfords

- https://www.halfords.com/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.halfords.com/help-and-advice/orders-and-bookings/returns-and-refunds/returns-information — “Access Denied” — **unreadable: blocked by the site**
- https://www.halfords.com/help-and-advice/orders-and-bookings/returns-and-refunds/returns-faqs — “Access Denied” — **unreadable: blocked by the site**

## JoJo Maman Bébé

- https://www.jojomamanbebe.co.uk/ — “JoJo Maman Bébé | Baby, Kids, Maternity, Equipment & Toys” — HTTP 200
- https://www.jojomamanbebe.co.uk/terms — “Terms & Conditions | JoJo Maman Bébé” — HTTP 200
  - > Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, if you are contracting with us as a consumer online or by phone, you have the right to cancel your contract at any time up to 14 days after the day on which you receive the goods you ordered. _(online, counts from delivery)_
  - > You must inform us of your wish to cancel in writing either by letter, email or by using the cancellation form on the website or call 0333 777 4529 within a period of 14 days beginning on the day after the day you receive your goods. _(counts from delivery)_
  - > You must return goods in their original packaging, wherever possible, within 14 days of informing us of your wish to cancel.
  - > Orders delivered to stores that are not collected within 10 days of the collection date will be returned to the warehouse and a refund processed. _(counts from delivery)_
  - > In the event the referred customer orders are placed and cancelled, or refunded in full, within 14 days of placing their order, the referring customer will not be entitled to their offer.
  - > Refunds are normally processed within 5-days of receipt of goods at our warehouse. _(counts from delivery)_
