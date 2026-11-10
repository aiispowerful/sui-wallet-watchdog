import "server-only";
import { z } from "zod";
import { isSuiAddress, normalizeAddress } from "./sui/normalize";
import { DEMO_ADDRESS } from "./sui/fixture";

export const AddressSchema = z
  .string()
  .trim()
  .refine((v) => v.toLowerCase() === "demo" || isSuiAddress(v), "Enter a Sui address (0x…) or 'demo'");

/** Address used for memory scoping: "demo" maps to the fixture wallet address. */
export function scopeAddress(input: string): string {
  return input.trim().toLowerCase() === "demo" ? DEMO_ADDRESS : normalizeAddress(input);
}

export function jsonError(e: unknown, status = 500) {
  if (e instanceof z.ZodError) {
    return Response.json({ error: e.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const message = e instanceof Error ? e.message : String(e);
  console.error("[watchdog]", message);
  return Response.json({ error: message }, { status });
}
