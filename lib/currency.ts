// Reimbursement amounts are stored as integer cents (see reimbursement_regions
// .amount_cents) so totals can be SUMmed in Postgres without float drift. This
// is the single place that turns those cents back into something displayable.

/**
 * Formats integer cents as USD.
 *
 * Cents are dropped when the total lands on a whole dollar — travel tiers are
 * configured in round amounts, so "$12,500" reads better than "$12,500.00" —
 * but a tier edited to an odd amount still renders exactly rather than being
 * silently rounded.
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  const isWholeDollar = Number.isInteger(dollars);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: isWholeDollar ? 0 : 2,
    maximumFractionDigits: isWholeDollar ? 0 : 2,
  }).format(dollars);
}
