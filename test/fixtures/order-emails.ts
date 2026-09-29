/**
 * Order emails in the layouts UK shops send them — written to those layouts
 * for this suite, not copied from anyone's inbox, so they carry no personal
 * data and name no real order. What they reproduce is the SHAPE the parser
 * has to survive: the subtotal above the total, the delivery line, the
 * order number that looks like a price, the time after the date, the item on
 * a quantity line, the "Delivered" date three lines below the order date.
 *
 * Dated relative to 28 September 2026, the suite's today.
 */
export interface OrderEmail {
  name: string;
  text: string;
  expect: {
    store: string | null;
    pence: number | null;
    purchasedOn: string;
    item: string | null;
    arrivedOn?: string | null;
    dispatchedOn?: string | null;
  };
}

export const ORDER_EMAILS: OrderEmail[] = [
  {
    name: 'Amazon, delivered, with a subtotal and postage',
    text: `Your Amazon.co.uk order has been delivered
Order #204-1234567-7654321
Ordered on 14 September 2026
Delivered 17 September 2026

1 x Anker USB-C charger £25.99
Item(s) Subtotal: £25.99
Postage & Packing: £0.00
Order Total: £25.99`,
    expect: { store: 'Amazon', pence: 2599, purchasedOn: '2026-09-14', item: 'Anker USB-C charger', arrivedOn: '2026-09-17' },
  },
  {
    name: 'ASOS, a thousand-pound figure without a comma',
    text: `Thanks for your order!
ASOS
Order No. 987654321
Order date: 20 Sep 2026

Qty 1 × Leather jacket £1049.00
Subtotal £1049.00
Standard Delivery £4.50
Total £1053.50`,
    expect: { store: 'ASOS', pence: 105350, purchasedOn: '2026-09-20', item: 'Leather jacket' },
  },
  {
    name: 'Argos, a time after the date',
    text: `Argos order confirmation
Order placed: Sat 5 Sep 2026 23:10
Item: Kenwood kMix stand mixer
Quantity: 1
Total to pay: £199.99`,
    expect: { store: 'Argos', pence: 19999, purchasedOn: '2026-09-05', item: 'Kenwood kMix stand mixer' },
  },
  {
    name: 'John Lewis, delivered, VAT line before the total',
    text: `John Lewis & Partners
Your order has been delivered
Order number: 12345678
Order placed 2 September 2026
Delivered 6 September 2026

Sony WH-1000XM6 headphones £349.00
VAT £58.17
Order total: £349.00`,
    expect: { store: 'John Lewis', pence: 34900, purchasedOn: '2026-09-02', item: 'Sony WH-1000XM6 headphones', arrivedOn: '2026-09-06' },
  },
  {
    name: 'Currys, total savings above the total',
    text: `Currys
Thanks for your order - 21/09/2026
1 x Russell Hobbs kettle £39.99
Total savings £10.00
Total £29.99`,
    expect: { store: 'Currys', pence: 2999, purchasedOn: '2026-09-21', item: 'Russell Hobbs kettle' },
  },
  {
    name: 'Zara, dispatched, a thousands comma',
    text: `ZARA
Your order has been dispatched
Order date 10 September 2026
Dispatched 12 September 2026
Wool-blend overcoat £1,199.00
Total £1,199.00`,
    expect: { store: 'Zara', pence: 119900, purchasedOn: '2026-09-10', item: 'Wool-blend overcoat', dispatchedOn: '2026-09-12' },
  },
  {
    name: 'Boots, product label, an Advantage Card line',
    text: `Boots.com order confirmation
Order date: 18/09/2026
Product: No7 Protect & Perfect serum
Advantage Card points earned: 36
Order total £38.00`,
    expect: { store: 'Boots', pence: 3800, purchasedOn: '2026-09-18', item: 'No7 Protect & Perfect serum' },
  },
  {
    name: 'IKEA, a sub-total written apart',
    text: `IKEA order confirmation
Order date 1 September 2026
MALM chest of 6 drawers £199.00
Sub-total £199.00
Delivery £35.00
Total £234.00`,
    expect: { store: 'IKEA', pence: 23400, purchasedOn: '2026-09-01', item: 'MALM chest of 6 drawers' },
  },
  {
    name: 'Next, order number that looks like money, month-first date',
    text: `Next
Order reference: 44521
Placed on September 22, 2026
1 x Slim fit chinos £30.00
Delivery £3.99
Order total £33.99`,
    expect: { store: 'Next', pence: 3399, purchasedOn: '2026-09-22', item: 'Slim fit chinos' },
  },
  {
    name: 'a shop kept does not know, labelled item',
    text: `Order confirmation — The Corner Bookshop
Order date: 24 September 2026
Item: The Remains of the Day (paperback)
Total: £9.99`,
    expect: { store: null, pence: 999, purchasedOn: '2026-09-24', item: 'The Remains of the Day (paperback)' },
  },
  {
    name: 'nothing that names the item',
    text: `Uniqlo
Thank you for your order
Order date 15 Sep 2026
Total £45.00`,
    expect: { store: 'Uniqlo', pence: 4500, purchasedOn: '2026-09-15', item: null },
  },
];
