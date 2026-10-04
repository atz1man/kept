// Awkward but realistic UK till slips. `expect` is what a person would say
// the receipt says. Dates are written as printed; `day` is the ISO date.
export const SLIPS = [
  { name: 'tesco-balance-due', store: 'Tesco', total: '£20.45', day: '2026-09-28', lines: [
    'TESCO', 'Tesco Stores Ltd', 'Kensington Superstore', '', 'WHOLE MILK 4PT        1.65', 'BANANAS LOOSE         0.98',
    'FAIRY LIQUID 820ML    3.50', 'KETTLE CHIPS 150G     2.25', 'PHILIPS HAIR CLIPPER 15.07', '', 'SUBTOTAL             23.45',
    'CLUBCARD PRICES      -3.00', '', 'BALANCE DUE          20.45', 'VISA                 20.45', '', '28/09/26 12:04  ST:2044  OP:118' ] },
  { name: 'sainsburys-nectar', store: 'Sainsbury’s', total: '£14.20', day: '2026-09-26', lines: [
    "Sainsbury's", 'Supermarkets Ltd', 'Holborn Circus', '', 'JS BREAD WHITE        1.10', 'TU KIDS T-SHIRT 2PK  12.00',
    'ROBINSONS SQUASH      1.10', '', '3 BALANCE DUE        14.20', 'MASTERCARD           14.20', '',
    'NECTAR POINTS EARNED     14', 'POINTS BALANCE          312', '', '26/09/2026 17:41' ] },
  { name: 'ms-sparks', store: 'M&S', total: '£41.00', day: '2026-09-25', lines: [
    'M&S', 'Marks and Spencer plc', 'Marble Arch', '', 'MENS CHINO 32S       35.00', 'COTTON SOCKS 5PK     10.00',
    'SPARKS OFFER         -4.50', 'PLASTIC BAG           0.50', '', 'TOTAL                41.00',
    'CONTACTLESS          41.00', '', 'VAT RATE   NET    VAT', 'A  20%    34.17   6.83', '', '25 Sep 2026   11:02' ],
    note: 'total printed is 41.00 — expect £41.00', totalOverride: '£41.00' },
  { name: 'currys-care-plan', store: 'Currys', total: '£1,448.00', day: '2026-09-24', lines: [
    'Currys', 'Tottenham Court Rd', '', 'LG OLED55C4 TV    1,299.00', 'CARE & REPAIR 3YR   149.00', '',
    'TOTAL             1,448.00', 'AMEX              1,448.00', '', 'Order 7731-0042', '24/09/2026 15:20' ] },
  { name: 'tkmaxx-card', store: null, total: '£59.98', day: '2026-09-27', lines: [
    'TK MAXX', 'Oxford Street', '', 'LADIES COAT          39.99', 'SCARF                19.99', '', 'SUBTOTAL             59.98',
    'TOTAL                59.98', 'CARD                 59.98', 'CHANGE                0.00', '', '27-09-2026 13:13' ] },
  { name: 'boots-points-savings', store: 'Boots', total: '£19.99', day: '2026-09-29', lines: [
    'Boots', 'Victoria Station', '', 'NO7 LIFT & LUMINATE  24.99', '3 FOR 2 SAVING       -5.00', '', 'TOTAL SAVINGS         5.00',
    'TOTAL                19.99', 'VISA DEBIT           19.99', '', 'ADVANTAGE POINTS       80', '29/09/2026 08:55' ] },
  { name: 'argos-cash-change', store: 'Argos', total: '£7.45', day: '2026-09-23', lines: [
    'ARGOS', 'Argos Ltd', 'Store 0412 Croydon', '', 'AA BATTERIES 12PK     7.45', '', 'TOTAL                 7.45',
    'CASH                 10.00', 'CHANGE                2.55', '', '23.09.26 10:41' ] },
  { name: 'johnlewis-vat-after', store: 'John Lewis', total: '£249.00', day: '2026-09-22', lines: [
    'JOHN LEWIS', '& PARTNERS', 'Oxford Street', '', 'DELONGHI MAGNIFICA 249.00', '', 'TOTAL              249.00',
    'Includes VAT       41.50', 'MASTERCARD         249.00', '', '22/09/2026  16:30  TILL 14' ] },
  { name: 'uniqlo-tax-incl', store: 'Uniqlo', total: '£29.90', day: '2026-09-21', lines: [
    'UNIQLO', 'Regent Street', '', 'HEATTECH CREW NECK    14.95', 'HEATTECH CREW NECK    14.95', '',
    'Total(tax incl.)     29.90', 'Card                 29.90', '', '2026/09/21 18:22' ] },
  { name: 'next-total-due', store: 'Next', total: '£55.00', day: '2026-09-20', lines: [
    'NEXT', 'Next Retail Ltd', 'Westfield', '', 'QUILTED JACKET       55.00', '', 'TOTAL DUE            55.00',
    'VISA                 55.00', '', 'Date: 20/09/2026 Time: 14:02' ] },
  { name: 'decathlon-multibuy', store: 'Decathlon', total: '£20.00', day: '2026-09-19', lines: [
    'DECATHLON', 'Surrey Quays', '', 'KIPRUN RUNNING SHOE  30.00', 'MEMBER DISCOUNT     -10.00', '', 'TOTAL EUR/GBP        20.00',
    'CB                   20.00', '', '19/09/2026 09:12' ] },
  { name: 'hm-items-count', store: 'H&M', total: '£27.98', day: '2026-09-18', lines: [
    'H&M', 'Hennes & Mauritz UK', '', 'JEANS SLIM          19.99', 'T-SHIRT              7.99', '', 'Total items: 2',
    'Total:              27.98', 'Debit card          27.98', '', '18.09.2026 12:30' ] },
];
