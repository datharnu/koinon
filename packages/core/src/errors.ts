export const ErrorCode = {
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  REQUEST_EXPIRED: "REQUEST_EXPIRED",
  ALREADY_SIGNED: "ALREADY_SIGNED",
  PSBT_MISMATCH: "PSBT_MISMATCH",
  SIG_INVALID: "SIG_INVALID",
  TIMELOCK_NOT_MET: "TIMELOCK_NOT_MET",
  RATE_STALE: "RATE_STALE",
  RATE_UNAVAILABLE: "RATE_UNAVAILABLE",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  FEE_OVER_CAP: "FEE_OVER_CAP",
  NODE_REJECTED: "NODE_REJECTED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class KoinonError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "KoinonError";
    this.code = code;
  }
}
