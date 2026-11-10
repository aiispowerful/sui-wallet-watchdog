import { z } from "zod";
import { rememberPreference } from "@/lib/agent/learn";
import { AddressSchema, jsonError, scopeAddress } from "@/lib/api";
import { getDeps } from "@/lib/server";

export const maxDuration = 60;

const Body = z
  .object({
    address: AddressSchema,
    minOutflowSui: z.number().min(0).max(1e9).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((b) => b.minOutflowSui !== undefined || (b.note && b.note.trim()), "Provide a threshold or a note");

export async function POST(req: Request) {
  try {
    const { address, minOutflowSui, note } = Body.parse(await req.json());
    const { memory, cfg } = getDeps();
    const res = await rememberPreference(memory, cfg.memwalNamespacePrefix, scopeAddress(address), { minOutflowSui, note });
    return Response.json({ ...res, store: memory.kind });
  } catch (e) {
    return jsonError(e);
  }
}
