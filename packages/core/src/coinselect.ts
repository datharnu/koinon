import { ErrorCode, KoinonError } from "./errors.js";

export const DUST_SATS = 546n;

export interface Coin {
  txid: string;
  vout: number;
  value: bigint;
  change: 0 | 1;
  index: number;
}

export interface CoinSelection {
  inputs: Coin[];
  recipient: bigint;
  fee: bigint;
  change: bigint;
}

/** Conservative vbyte estimate for this witness script. Overpaying the fee is safe; underpaying is not. */
export function estimateVbytes(inputCount: number, outputCount: number): number {
  return 20 + inputCount * 180 + outputCount * 50;
}

/**
 * Greedy largest-first selection.
 * The recipient output is exactly `amount`. Change, when present, is what remains after the fee.
 */
export function selectCoins(args: {
  coins: Coin[];
  amount: bigint;
  feeCap: bigint;
  feeRate?: bigint;
  dust?: bigint;
}): CoinSelection {
  const feeRate = args.feeRate ?? 1n;
  const dust = args.dust ?? DUST_SATS;
  if (args.amount <= 0n || feeRate <= 0n || args.feeCap <= 0n) {
    throw new KoinonError(ErrorCode.VALIDATION, "amount, fee rate, and fee cap must be positive");
  }
  const ordered = [...args.coins].sort((left, right) => {
    if (left.value === right.value) return left.vout - right.vout;
    return left.value > right.value ? -1 : 1;
  });
  const total = ordered.reduce((sum, coin) => sum + coin.value, 0n);
  const cheapestFee = BigInt(estimateVbytes(1, 1)) * feeRate;
  if (total < args.amount + cheapestFee) {
    throw new KoinonError(ErrorCode.INSUFFICIENT_FUNDS, "the fund cannot cover this amount and fee");
  }

  const chosen: Coin[] = [];
  let sum = 0n;
  for (const coin of ordered) {
    chosen.push(coin);
    sum += coin.value;
    const plan = planFee(sum, chosen.length, args.amount, feeRate, args.feeCap, dust);
    if (plan) {
      return { inputs: chosen, recipient: args.amount, fee: plan.fee, change: plan.change };
    }
  }
  throw new KoinonError(ErrorCode.FEE_OVER_CAP, "the fee for this spend is above the fee cap");
}

function planFee(
  sum: bigint,
  inputCount: number,
  amount: bigint,
  feeRate: bigint,
  feeCap: bigint,
  dust: bigint,
): { fee: bigint; change: bigint } | null {
  const twoOutputFee = BigInt(estimateVbytes(inputCount, 2)) * feeRate;
  const change = sum - amount - twoOutputFee;
  if (change >= dust && twoOutputFee <= feeCap) {
    return { fee: twoOutputFee, change };
  }
  const oneOutputFee = BigInt(estimateVbytes(inputCount, 1)) * feeRate;
  const leftover = sum - amount;
  if (change < dust && leftover >= oneOutputFee && leftover <= feeCap) {
    return { fee: leftover, change: 0n };
  }
  return null;
}
