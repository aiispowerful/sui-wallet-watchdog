import "server-only";
import { z } from "zod";
import { AuthError } from "./auth/errors";
import { isSuiAddress } from "./sui/normalize";

export const AddressSchema = z
  .string()
  .trim()
  .refine((v) => isSuiAddress(v), "Enter a Sui address (0x…)");

export { scopeAddress } from "./wallet-id";

export function jsonError(e: unknown, status = 500) {
  if (e instanceof z.ZodError) {
    return Response.json({ error: e.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  if (e instanceof AuthError) {
    return Response.json({ error: e.message, code: e.code }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : String(e);
  console.error("[watchdog]", message);
  return Response.json({ error: message }, { status });
}
