export const MAX_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM = 10;

export function parseBusinessReimbursementRate(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM
  ) {
    return null;
  }

  return value;
}
