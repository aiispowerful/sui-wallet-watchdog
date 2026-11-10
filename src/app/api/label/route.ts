import { z } from "zod";
import { rememberLabel } from "@/lib/agent/learn";
import { AddressSchema, jsonError, scopeAddress } from "@/lib/api";
import { getDeps } from "@/lib/server";

export const maxDuration = 60;

const CandidateSchema = z.object({
  id: z.string().max(300),
  kind: z.enum(["large_outflow", "new_counterparty", "unknown_token_inflow", "new_contract", "failed_tx", "high_gas", "activity_burst"]),
  severity: z.enum(["low", "medium", "high"]),
  digest: z.string().max(100).optional(),
  timestampMs: z.number().optional(),
  subject: z.string().max(300).optional(),
  subjectLabel: z.string().max(300).optional(),
  amount: z.number().optional(),
  symbol: z.string().max(40).optional(),
  summary: z.string().max(600),
});

const Body = z.object({
  address: AddressSchema,
  candidate: CandidateSchema,
  verdict: z.enum(["expected", "suspicious"]),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const { address, candidate, verdict, note } = Body.parse(await req.json());
    const { memory, cfg } = getDeps();
    const res = await rememberLabel(memory, cfg.memwalNamespacePrefix, scopeAddress(address), candidate, verdict, note);
    return Response.json({ ...res, store: memory.kind });
  } catch (e) {
    return jsonError(e);
  }
}
