import { normalizeAddress } from "./sui/normalize";

/** Canonical 0x-padded address used for memory scoping and auth checks. */
export function scopeAddress(input: string): string {
  return normalizeAddress(input);
}
