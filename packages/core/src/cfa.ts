import { ErrorCode, KoinonError } from "./errors.js";

/** West African CFA franc per euro. The peg is fixed; this fraction is exact. */
export const XOF_PER_EUR_NUMERATOR = 655957n;
export const XOF_PER_EUR_DENOMINATOR = 1000n;
export const PEG_TEXT = "655.957";

interface Decimal {
  num: bigint;
  scale: bigint;
}

export function parseDecimal(value: string): Decimal {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new KoinonError(ErrorCode.VALIDATION, "invalid decimal");
  }
  const [whole, fraction = ""] = value.split(".");
  return {
    num: BigInt(`${whole}${fraction}`),
    scale: 10n ** BigInt(fraction.length),
  };
}

/** Exact XOF per BTC from a BTC/EUR decimal. The result terminates. */
export function xofPerBtcFromEur(eurPerBtc: string): string {
  const { num, scale } = parseDecimal(eurPerBtc);
  if (num === 0n) {
    throw new KoinonError(ErrorCode.VALIDATION, "btc/eur rate is zero");
  }
  return formatExact(num * XOF_PER_EUR_NUMERATOR, scale * XOF_PER_EUR_DENOMINATOR);
}

/**
 * Sats required to cover `amountXof` at this BTC/EUR rate.
 * Rounded up so the recipient is never short a franc.
 */
export function satsForXof(amountXof: bigint, eurPerBtc: string): bigint {
  if (amountXof <= 0n) {
    throw new KoinonError(ErrorCode.VALIDATION, "amount must be positive");
  }
  const { num, scale } = parseDecimal(eurPerBtc);
  const denominator = num * XOF_PER_EUR_NUMERATOR;
  const numerator = amountXof * 100_000_000n * scale * XOF_PER_EUR_DENOMINATOR;
  return divCeil(numerator, denominator);
}

/** Display conversion. Floored so the ledger does not claim francs the rate does not support. */
export function xofForSats(sats: bigint, eurPerBtc: string): bigint {
  if (sats < 0n) {
    throw new KoinonError(ErrorCode.VALIDATION, "sats must be non-negative");
  }
  const { num, scale } = parseDecimal(eurPerBtc);
  return (sats * num * XOF_PER_EUR_NUMERATOR) / (100_000_000n * scale * XOF_PER_EUR_DENOMINATOR);
}

function divCeil(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function formatExact(numerator: bigint, denominator: bigint): string {
  const whole = numerator / denominator;
  let remainder = numerator % denominator;
  if (remainder === 0n) return whole.toString();
  let fraction = "";
  while (remainder !== 0n) {
    if (fraction.length > 40) {
      throw new KoinonError(ErrorCode.VALIDATION, "rate decimal did not terminate");
    }
    remainder *= 10n;
    fraction += (remainder / denominator).toString();
    remainder %= denominator;
  }
  return `${whole}.${fraction}`;
}
