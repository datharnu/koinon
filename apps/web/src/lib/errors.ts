/** Reads an error code without importing the signing stack. */
export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  if (error instanceof Error && error.message === "NO_KEY") return "NO_KEY";
  if (error instanceof Error && /wrong pin/i.test(error.message)) return "WRONG_PIN";
  return "UNKNOWN";
}
