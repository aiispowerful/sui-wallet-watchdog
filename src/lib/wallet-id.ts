import { DEMO_ADDRESS } from "./sui/fixture";
import { isSuiAddress, normalizeAddress } from "./sui/normalize";

/** Address used for memory scoping: "demo" maps to the fixture wallet address. */
export function scopeAddress(input: string): string {
  return input.trim().toLowerCase() === "demo" ? DEMO_ADDRESS : normalizeAddress(input);
}

export function isDemoWallet(input: string): boolean {
  const v = input.trim().toLowerCase();
  if (v === "demo") return true;
  if (!isSuiAddress(v)) return false;
  return normalizeAddress(v) === DEMO_ADDRESS;
}
