# Candidate retailers, read from their own sites — 2026-10-03

Written by `npm run check:retailers -- --candidates`. Each shop's listed returns page was read; where none was listed, or it stated no period, the homepage was opened and the shop's own Returns/Refunds links followed. The periods column counts how often each number appears in a sentence about returns: a summary to read the quotes against, never a value to copy. A shop goes into `stores.ts` by hand, from the quotes, with its returns page added to `retailer-sources.json` in the same change.

| Shop | Status | Periods named | Clock named |
|---|---|---|---|
| Asda | read | 14 days ×5, 100 days ×2, 5 days ×1 | delivery |
| Morrisons | read | 14 days ×2, 30 days ×1 | delivery |
| Waitrose | unreadable: HTTP 502 | — | — |
| Harrods | unreadable: blocked by the site | — | — |
| House of Fraser | unreadable: HTTP 502; blocked by the site | — | — |
| Primark | unreadable: blocked by the site | — | — |
| TK Maxx | unreadable: blocked by the site | — | — |
| Mango | unreadable: blocked by the site | — | — |
| Shein | read | 14 days ×1 | — |
| Very | unreadable: blocked by the site | — | — |
| JD Sports | no returns link found | — | — |
| Schuh | unreadable: blocked by the site | — | — |
| Superdry | no window found | — | — |
| Urban Outfitters | unreadable: blocked by the site | — | — |
| Reiss | no window found | — | — |
| Office | unreadable: blocked by the site | — | — |
| Footasylum | unreadable: blocked by the site; HTTP 502 | — | — |
| Adidas | unreadable: HTTP 502; blocked by the site | — | — |
| Lululemon | unreadable: blocked by the site | — | — |
| AO | unreadable: blocked by the site | — | — |
| CeX | read | 14 days ×2 | delivery |
| GAME | read | 28 days ×5, 14 days ×2, 30 days ×1 | delivery, purchase |
| Smyths | unreadable: blocked by the site | — | — |
| The Entertainer | unreadable: blocked by the site; page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://ask.thetoyshop.com/help/returns | — | — |
| Hamleys | unreadable: blocked by the site | — | — |
| Dyson | read | 35 days ×4, 14 days ×3 | delivery |
| The Range | read | 14 days ×3 | delivery |
| Homebase | unreadable: blocked by the site; page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.homebase.co.uk/hc/en-gb/articles/30405319631505-Can-I-return-my-online-order-for-a-refund; page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.homebase.co.uk/hc/en-gb/articles/30055728344081-Can-I-return-my-items-purchased-from-a-store | — | — |
| DFS | unreadable: blocked by the site | — | — |
| Furniture Village | no window found | — | — |
| Oak Furnitureland | read | 3 days ×1 | delivery |
| Wayfair | unreadable: blocked by the site | — | — |
| Lakeland | no window found | — | — |
| Robert Dyas | read | 5 days ×2, 30 days ×1 | purchase |
| Hobbycraft | unreadable: blocked by the site | — | — |
| Superdrug | unreadable: blocked by the site | — | — |
| Lush | read | 14 days ×1 | delivery |
| Space NK | read | 28 days ×3, 14 days ×2, 5 days ×1 | purchase, delivery |
| Sephora | unreadable: blocked by the site | — | — |
| Waterstones | unreadable: blocked by the site | — | — |
| WHSmith | unreadable: HTTP 502 | — | — |
| Ryman | unreadable: blocked by the site | — | — |
| Mountain Warehouse | read | 60 days ×1 | — |
| Cotswold Outdoor | read | 14 days ×4, 30 days ×1, 100 days ×1 | purchase, delivery |
| Halfords | unreadable: blocked by the site | — | — |
| JoJo Maman Bébé | read | 14 days ×4, 5 days ×1, 10 days ×1 | delivery |
| Home Bargains | read | 28 days ×2 | purchase |
| Hotter | unreadable: blocked by the site | — | — |
| Phase Eight | read | 14 days ×6, 5 days ×1, 7 days ×1, 28 days ×1, 30 days ×1 | delivery |
| Ted Baker | read | 28 days ×5, 14 days ×1 | purchase, delivery |
| Sweaty Betty | read | 45 days ×1 | delivery |
| Moss | read | 14 days ×5, 7 days ×3 | delivery |
| Charles Tyrwhitt | read | 30 days ×2, 14 days ×1 | delivery, dispatch, purchase |
| Bonmarché | read | 14 days ×3, 28 days ×3 | purchase |
| Iceland | read | 14 days ×4, 5 days ×2 | delivery |
| Ocado | no returns link found | — | — |
| Co-op | unreadable: blocked by the site | — | — |
| Pandora | no window found | — | — |
| Ernest Jones | unreadable: blocked by the site | — | — |
| H.Samuel | unreadable: blocked by the site | — | — |
| Goldsmiths | read | 14 days ×6, 30 days ×1 | delivery |
| Hotel Chocolat | read | 14 days ×8, 28 days ×2, 30 days ×2 | dispatch, delivery |
| Disney Store | no returns link found | — | — |
| Build-A-Bear | unreadable: blocked by the site | — | — |
| Foyles | unreadable: blocked by the site | — | — |
| Flying Tiger | read | 14 days ×4 | delivery |
| Rohan | no window found | — | — |
| Evans Cycles | unreadable: HTTP 502 | — | — |
| Jollyes | unreadable: blocked by the site | — | — |
| Bensons for Beds | read | 14 days ×1 | delivery |
| Dreams | read | 14 days ×4 | delivery |
| Loaf | unreadable: blocked by the site | — | — |
| Sofology | read | 14 days ×4, 7 days ×1, 30 days ×1 | delivery |
| ScS | unreadable: blocked by the site | — | — |
| Barker and Stonehouse | read | 14 days ×4 | delivery |
| Littlewoods | unreadable: blocked by the site | — | — |
| Simply Be | unreadable: blocked by the site | — | — |
| Freemans | read | 14 days ×19, 10 days ×5, 60 days ×5, 5 days ×2, 7 days ×1, 28 days ×1 | purchase, delivery |
| QVC | unreadable: HTTP 418 | — | — |
| The Perfume Shop | unreadable: blocked by the site | — | — |
| Hollister | no window found | — | — |
| Abercrombie & Fitch | no window found | — | — |
| Gap | no returns link found | — | — |
| Pull&Bear | no window found | — | — |
| Stradivarius | no window found | — | — |
| COS | unreadable: blocked by the site | — | — |
| & Other Stories | unreadable: blocked by the site | — | — |
| Arket | unreadable: blocked by the site | — | — |
| Thorntons | read | 14 days ×4 | delivery |
| Moonpig | read | 14 days ×1 | delivery |
| Funky Pigeon | read | 14 days ×5, 30 days ×3 | delivery, purchase |
| Dell | read | 14 days ×9 | purchase, delivery |
| Lenovo | read | 14 days ×4 | delivery, purchase |
| HP Store | read | 14 days ×1 | delivery |
| Scan Computers | unreadable: blocked by the site | — | — |
| Overclockers UK | unreadable: blocked by the site | — | — |
| Laptops Direct | read | 14 days ×3, 30 days ×1 | delivery |
| Hughes | read | 14 days ×4, 30 days ×1 | delivery |
| Euronics | read | 30 days ×1 | delivery |
| Sonos | read | 15 days ×1, 30 days ×1 | — |
| Harvey Nichols | unreadable: HTTP 502 | — | — |
| Sosandar | read | 14 days ×2, 7 days ×1 | delivery |
| Hush | unreadable: blocked by the site | — | — |
| ME+EM | read | 14 days ×7, 7 days ×3, 21 days ×1 | delivery |
| Rixo | read | 10 days ×2, 14 days ×2, 7 days ×1 | delivery |
| Free People | unreadable: blocked by the site | — | — |
| Anthropologie | unreadable: blocked by the site | — | — |
| In The Style | read | 14 days ×3 | purchase, delivery |
| Quiz | no returns link found | — | — |
| Yours Clothing | unreadable: blocked by the site | — | — |
| Roman Originals | unreadable: blocked by the site | — | — |
| Damart | no window found | — | — |
| Cotton Traders | read | 14 days ×2 | delivery |
| The White Company | no window found | — | — |
| Brora | unreadable: HTTP 502 | — | — |
| Joules | no returns link found | — | — |

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

## Harrods

- https://www.harrods.com/en-gb/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.harrods.com/en-gb/c/faqs/returns — “Access Denied” — **unreadable: blocked by the site**

## House of Fraser

- https://www.houseoffraser.co.uk/ — **unreadable: HTTP 502**
- https://help.houseoffraser.co.uk/support/solutions/articles/80001157126-i-need-to-return-an-item-bought-online — “Just a moment...” — **unreadable: blocked by the site**
- https://help.houseoffraser.co.uk/support/solutions/articles/80001157127-i-need-to-return-my-order-or-item-bought-in-store — “Just a moment...” — **unreadable: blocked by the site**

## Primark

- https://www.primark.com/en-gb — “Planned maintenance” — **unreadable: blocked by the site**
- https://www.help.primark.com/hc/en-gb/articles/115005690845-Refunds-and-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**

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

## Superdry

- https://www.superdry.com/ — “Superdry UK: 15% Off Your First Order | Men's & Women's Clothing” — HTTP 200
- https://help.superdry.com/Returns/Returns-Policy/1660038622/What-is-your-return-policy.htm — **unreadable: page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://help.superdry.com/Returns/Returns-Policy/1660038622/What-is-your-return-policy.htm**
- https://www.superdry.com/help-centre.html — “Customer Service” — HTTP 200

## Urban Outfitters

- https://www.urbanoutfitters.com/en-gb/ — “urbanoutfitters.com” — **unreadable: blocked by the site**
- https://www.urbanoutfitters.com/en-gb/help/return-policy — “urbanoutfitters.com” — **unreadable: blocked by the site**

## Reiss

- https://www.reiss.com/ — “Reiss UK - Womenswear, Menswear, & Accessories” — HTTP 200
- https://help.reiss.com/hc/en-gb/articles/4411046702609-Our-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**
- https://help.reiss.com/hc/en-gb/articles/4429050436881-Returning-Store-Purchases — “Just a moment...” — **unreadable: blocked by the site**
- https://help.reiss.com/hc/en-gb — “REISS Help Centre” — HTTP 200
- https://help.reiss.com/hc/en-gb/sections/4409276978065 — “Returns/Refunds – REISS Help Centre” — HTTP 200
- https://help.reiss.com/hc/en-gb/sections/4409276978065-Returns-Refunds — “Just a moment...” — **unreadable: blocked by the site**
- https://help.reiss.com/hc/en-gb/articles/4409559256849-How-do-I-return-an-online-order — “Just a moment...” — **unreadable: blocked by the site**
- https://help.reiss.com/hc/en-gb/articles/4409516698257-Return-Costs-and-Refunds — “Just a moment...” — **unreadable: blocked by the site**

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

## CeX

- https://uk.support.webuy.com/support/solutions/articles/80001011699-returning-an-unwanted-online-order — “CeX (UK) : Contact CeX” — HTTP 200
  - > You will need to notify us within 14 days of your delivery of your wish to return the item, after which, you then have a further 14 days from notifying us to return the item, either to a store or by posting it back to us. _(counts from delivery)_
  - > You may also return any unwanted online order by taking it into any CeX store within 14 days of delivery for a full refund, without needing to notify us in advance. _(online, counts from delivery)_

## GAME

- https://helps.game.co.uk/en/support/solutions/articles/80000620493-game-returns-policy — **unreadable: HTTP 502**
- https://help.game.co.uk/hc/en-gb/articles/6018073554719-DELIVERY-AND-RETURNS — “DELIVERY AND RETURNS – GAME” — HTTP 200
  - > In addition to your statutory rights (whereby you have 14 days from the date of delivery of your purchase(s) to notify us of a cancellation, followed by 14 days from the date of notification to return the unwanted purchase(s)), you have 28 days from the day after your items are delivered (or someone receives the items for you) or you collect your online purchase items from one of our stores (UK Mainland only) to change your mind and return the items back to us. _(online, counts from delivery)_
  - > If your order consists of multiple items or parts which are delivered on different days, then the cancellation period (in respect of your whole order) ends on the day 28 days after the day on which the last of the items or parts are delivered to you (or a person you have nominated to receive the order) _(online, counts from delivery)_
  - > You must return your items by post to the Returns Address no later than 28 days after the day on which the items are delivered to you (or someone receives the items for you) or you collect your items from one of our stores (UK Mainland only) to change your mind and return the items back to us. _(online, counts from delivery)_
  - > If your order consists of multiple items or parts which are delivered on different days, then the cancellation period (in respect of your whole order) ends on the day 28 days after the day on which the last of the items or parts are delivered to you (or a person you have nominated to receive the order). _(online, counts from delivery)_
  - > You will be refunded no later than 14 days after the day we receive the items you are returning. _(counts from delivery)_
  - > Tier 2: if more than 30 days have passed after you received the goods, you can claim a repair or a replacement of the defective item (but not a refund). _(counts from delivery)_
  - > return the defective item and claim a refund (but note that if you have had the goods for more than 6 months, this refund may be reduced to take account of any use you have had from the goods).
  - > If you change your mind and the item is not defective, please return your unwanted item(s) within 28 days of purchase to one of our stores, along with proof of purchase and you will be offered a credit note or exchange. _(counts from purchase)_

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

- https://help.therange.co.uk/hc/en-gb/articles/360015308140-What-is-your-returns-policy — “What is your returns policy? – The Range” — HTTP 200
  - > Simply return them in an unused condition within 14 days after you've received them. _(counts from delivery)_
  - > You may also return faulty items or anything damaged in transit free of charge within 14 days.
  - > Most small/regular items can be returned within 14 days of purchase by post using a recorded delivery method or the returns label included in the package. _(online, counts from delivery)_
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

## Superdrug

- https://www.superdrug.com/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.superdrug.com/returnPolicy — “Access Denied” — **unreadable: blocked by the site**

## Lush

- https://www.lush.com/uk/en/faq/returns-and-refunds — “Commerce Web - UK - Returns and Refunds | LUSH” — HTTP 200
  - > Where the products have already been delivered to you, we will process the refund due to you as soon as possible and, in any case, within 14 calendar days after the day on which we receive the returned products, or (if earlier) within 14 calendar days after the day you provide us with evidence that the products were returned to us. _(online, counts from delivery)_

## Space NK

- https://help.spacenk.com/hc/en-us/articles/360002297754-Returns-Policy-Store-Online — “Returns Policy - Store & Online – SPACE.NK.apothecary” — HTTP 200
  - > Unopened & Unused Products: Return within 28 days of purchase with proof of purchase for a full refund or exchange Your refund will be confirmed by email, and funds will be returned to your original payment method. _(counts from purchase)_
  - > Opened/Used Products: Return within 28 days of purchase with proof of purchase. _(counts from purchase)_
  - > The average processing time for returns is 14 working days once received in our warehouse, though it may take longer following the peak season. _(counts from delivery)_
  - > For our UK customers, sale items purchased online and in-store can be returned online and to our stores within 28 days of purchase with a proof of purchase. _(counts from purchase)_
  - > In addition to our returns policy, you have the right to cancel your order within 14 working days from the date of receipt of the goods if you send us a notice of cancellation in writing and return the goods to us in their original, unopened and unused condition. _(counts from delivery)_
  - > Once your refund has been processed, it can take your card provider 5 working days to credit your account.

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

- https://help.cotswoldoutdoor.com/hc/en-gb/articles/4411467010834-Returns-Policy — “Returns Policy – Cotswold Outdoor” — HTTP 200
  - > Full priced products can be returned for a refund within 30 days of purchase (100 days for Explore More members). _(counts from purchase)_
  - > For Sale/Clearance products, the return must be made within 14 days of purchase. _(counts from purchase)_
  - > Customers have the right to cancel their order within 14 days of receiving their goods, as per the Consumer Contracts Regulations 2013. _(counts from delivery)_
  - > For online purchases not collected in-store, these can be returned within 14 days of receipt. _(counts from delivery)_
  - > You have the right to cancel your order within 14 days of receipt of the products. _(counts from delivery)_

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

## Home Bargains

- https://help.homebargains.co.uk/hc/en-gb/articles/205395762-How-do-I-return-an-item — “How do I return an item? – Home Bargains Help Centre” — HTTP 200
- https://help.homebargains.co.uk/hc/en-gb/articles/200213017-What-is-your-returns-policy-for-in-store-purchases — “What is your returns policy for in store purchases? – Home Bargains Help Centre” — HTTP 200
  - > We offer a no quibble money back guarantee – If you return unused items, returned as sold, within 28-days of the date of purchase with your receipt, we will give you a full refund for the original purchase price of the product or exchange the product. _(counts from purchase)_
  - > If the period between purchase and return, even though below 28 days, has significantly reduced the usable life of the product. _(counts from purchase)_

## Hotter

- https://www.hotter.com/gb/en/ — “Just a moment...” — **unreadable: blocked by the site**
- https://www.hotter.com/gb/en/info/FAQ-returning-goods — “Just a moment...” — **unreadable: blocked by the site**

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

## Sweaty Betty

- https://www.sweatybetty.com/ — “Sweaty Betty London | Womens Activewear | Run & Yoga Clothes” — HTTP 200
  - > Looking for workout wear for different activities? Discover why almost 20,000 women rate our Power legging 5* and why our Explorer range is your crease-free collection for when you’re on the go with 45-day free returns across 150 countries. _(counts from delivery)_
- https://www.sweatybetty.com/delivery-returns.html — “Delivery + Returns” — **unreadable: blocked by the site**
- https://help.sweatybetty.com/kb/en/returns — **unreadable: HTTP 502**

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

## Bonmarché

- https://www.bonmarche.co.uk/returns-and-refunds/returns-and-refunds.html — “Returns & Refunds | Bonmarché” — HTTP 200
  - > You may return items bought online to any open Bonmarché store within 28 days of receipt. _(online, counts from purchase)_
  - > If you have paid postage on your order, this will not be refunded unless the item was faulty or you have provided the necessary written notice of contract cancellation within 14 days from the date the order was placed.
  - > Returns must be made within 28 days of receipt, must be in their original condition with all tags attached and must include the fully completed returns slip, or we will be unable to process your return.
  - > Please allow up to 14 days for your return to be processed.
  - > You may return items within 28 days of receipt.
  - > Please note: this excludes sale items, which must be returned within 14 days of the purchase date. _(counts from purchase)_

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
- https://help.ocadoretail.com/ — “Home” — **unreadable: left the shop's site for help.ocadoretail.com**

## Co-op

- https://www.coop.co.uk/ — **unreadable: blocked by the site**
- https://www.coop.co.uk/terms/delivery-click-and-collect-and-home-delivery-terms-and-conditions — **unreadable: blocked by the site**

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

## Disney Store

- https://www.disneystore.co.uk/ — “Disney Store UK | Discover and Buy Official Merchandise” — HTTP 200
- https://support.disneystore.co.uk/hc/en-gb/articles/20170021665171-General-Returns-Policy — “Just a moment...” — **unreadable: blocked by the site**
- https://support.disneystore.co.uk/hc/en-gb/articles/5655881774355-How-long-do-I-have-to-return-an-order-and-how-quickly-will-I-be-refunded — “Just a moment...” — **unreadable: blocked by the site**

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

## Littlewoods

- https://www.littlewoods.com/ — “Access Denied” — **unreadable: blocked by the site**
- https://www.littlewoods.com/delivery-options.page — “Access Denied” — **unreadable: blocked by the site**

## Simply Be

- https://www.simplybe.co.uk/ — “Simply Be - Down For Maintenance” — **unreadable: blocked by the site**
- https://support.simplybe.co.uk/hc/en-gb/articles/360011852400-What-is-your-return-policy — “Just a moment...” — **unreadable: blocked by the site**
- https://support.simplybe.co.uk/hc/en-gb/articles/360002530644-How-long-do-I-have-to-return-my-order — “Just a moment...” — **unreadable: blocked by the site**

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

## Pull&Bear

- https://www.pullandbear.com/gb/ — “PULL&BEAR United Kingdom | New Collection 2026 | Pull and Bear” — HTTP 200
- https://www.pullandbear.com/gb/faqs.html — “FAQs | Returns, shipping, exchanges and more | PULL&BEAR” — HTTP 200

## Stradivarius

- https://www.stradivarius.com/gb/ — “Stradivarius United Kingdom - New Collection Autumn 2026 | United Kingdom” — HTTP 200
- https://www.stradivarius.com/gb/help-center/article/returns/how-to-return-a-product — “seo.help-center-article-page-title” — HTTP 200

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

## Harvey Nichols

- https://www.harveynichols.com/ — **unreadable: HTTP 502**
- https://www.harveynichols.com/info/help/delivery-help/returns/ — **unreadable: HTTP 502**

## Sosandar

- https://www.sosandar.com/returns — “Returns” — HTTP 200
  - > Our standard returns policy is 14 days.
  - > You have 14 days from delivery to return your items. _(counts from delivery)_
  - > Refunds are processed within 7 working days of receiving your return. _(counts from delivery)_
- https://help.sosandar.com/hc/en-gb/articles/18169993767441-What-is-your-returns-policy — “Just a moment...” — **unreadable: blocked by the site**

## Hush

- https://www.hush-uk.com/ — “Vercel Security Checkpoint” — **unreadable: blocked by the site**
- https://www.hush-uk.com/faq — “Vercel Security Checkpoint” — **unreadable: blocked by the site**

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

## In The Style

- https://www.inthestyle.com/pages/returns — “Just a moment...” — **unreadable: blocked by the site**
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

## The White Company

- https://www.thewhitecompany.com/uk/ — “Page Not Found | The White Company US” — **unreadable: HTTP 404**
- https://www.thewhitecompany.com/us/?countryIsoCode=US&currencyIsoCode=USD&clear=true — “The White Company - US” — HTTP 200

## Brora

- https://www.brora.co.uk/ — **unreadable: HTTP 502**
- https://www.brora.co.uk/our-site/terms-conditions — **unreadable: HTTP 502**
- https://www.brora.co.uk/customer-service/return-faulty-or-incorrect-products — **unreadable: HTTP 502**

## Joules

- https://www.joules.com/ — “Joules | Women's, Men's & Children's Clothing And Footwear” — HTTP 200
- https://www.joules.com/faq/faqReturnsAndRefunds — “Just a moment...” — **unreadable: blocked by the site**
