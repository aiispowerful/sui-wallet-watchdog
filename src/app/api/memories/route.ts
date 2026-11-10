import { z } from "zod";
import { AddressSchema, jsonError, scopeAddress } from "@/lib/api";
import { requireSession } from "@/lib/auth/http";
import { getSessionSecret } from "@/lib/auth/secret";
import { memoryHeadline, namespaceFor } from "@/lib/memory/format";
import { getDeps } from "@/lib/server";

export const maxDuration = 30;

const Body = z.object({ address: AddressSchema, query: z.string().max(300).optional() });

/** Lists what the agent remembers about a wallet (semantic recall over its namespace). */
export async function POST(req: Request) {
  try {
    const { address, query } = Body.parse(await req.json());
    const { memory, cfg } = getDeps();
    const addr = scopeAddress(address);
    requireSession(req, addr, getSessionSecret());
    const namespace = namespaceFor(cfg.memwalNamespacePrefix, addr);
    const items = await memory.recall(query?.trim() || `wallet ${addr} user labels and preferences`, namespace, 50);
    return Response.json({
      namespace,
      store: memory.kind,
      memories: items.map((m) => ({ blobId: m.blobId, headline: memoryHeadline(m.text), distance: m.distance, createdAt: m.createdAt, parsed: m.parsed })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
