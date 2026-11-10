import { z } from "zod";
import { runScan } from "@/lib/agent/scan";
import { AddressSchema, jsonError } from "@/lib/api";
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
    return Response.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
