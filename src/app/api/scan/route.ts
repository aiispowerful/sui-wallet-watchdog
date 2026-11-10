import { z } from "zod";
import { runScan } from "@/lib/agent/scan";
import { AddressSchema, isDemoWallet, jsonError, scopeAddress } from "@/lib/api";
import { trySession } from "@/lib/auth/http";
import { redactScanForPublic } from "@/lib/auth/redact";
import { enforceScanRateLimit } from "@/lib/rate-limit";
import { getDeps } from "@/lib/server";

export const maxDuration = 60;

const Body = z.object({ address: AddressSchema, withoutMemory: z.boolean().optional() });

export async function POST(req: Request) {
  const limited = enforceScanRateLimit(req);
  if (limited) return limited;
  try {
    const { address, withoutMemory } = Body.parse(await req.json());
    const result = await runScan(address, getDeps(), { withoutMemory });
    const reveal = isDemoWallet(address) || trySession(req)?.addr === scopeAddress(address);
    return Response.json(reveal ? result : redactScanForPublic(result));
  } catch (e) {
    return jsonError(e);
  }
}
