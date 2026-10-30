/**
 * Splits a rupee amount into `parts` shares that add up to it exactly. Works in paise:
 * every share gets the floor, and the leftover paise go one each to the first shares.
 * Splitting two amounts where a >= b this way keeps every share of a >= its share of b.
 */
const splitAmount = (amount, parts) => {
  const paise = Math.round(Number(amount) * 100);
  const base = Math.floor(paise / parts);
  const extra = paise - base * parts;
  return Array.from({ length: parts }, (_, index) => (base + (index < extra ? 1 : 0)) / 100);
};

/** Each item's subtotal, GST, payout and platform fee for one multi-item cart line. */
const allocateItems = ({ subtotal, gst, payout }, count) => {
  const subtotals = splitAmount(subtotal, count);
  const gsts = splitAmount(gst, count);
  const payouts = splitAmount(payout, count);
  return subtotals.map((itemSubtotal, index) => ({
    subtotal: itemSubtotal,
    gst_amount: gsts[index],
    freelancer_payout: payouts[index],
    platform_fee: Math.round((itemSubtotal - payouts[index]) * 100) / 100,
  }));
};

module.exports = { splitAmount, allocateItems };
