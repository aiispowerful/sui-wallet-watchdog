import { z } from "zod";
import { rememberLabel } from "@/lib/agent/learn";
import { AddressSchema, isDemoWallet, jsonError, scopeAddress } from "@/lib/api";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/http";
import { labelMessageFromBody } from "@/lib/auth/messages";
import { verifyNonce } from "@/lib/auth/nonce";
import { getSessionSecret } from "@/lib/auth/secret";
import { isoFromUnix } from "@/lib/auth/token";
import { verifySignedMessage } from "@/lib/auth/verify-message";
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
  nonce: z.string().min(1).max(4000).optional(),
  message: z.string().min(1).max(4000).optional(),
  signature: z.string().min(1).max(8000).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const { memory, cfg } = getDeps();
    const addr = scopeAddress(body.address);

    if (isDemoWallet(body.address)) {
      const res = await rememberLabel(memory, cfg.memwalNamespacePrefix, addr, body.candidate, body.verdict, body.note, { demo: true });
      return Response.json({ ...res, store: memory.kind, demo: true });
    }

    const secret = getSessionSecret();
    requireSession(req, addr, secret);
    if (!body.nonce || !body.message || !body.signature) {
      throw new AuthError("A wallet signature is required to save this label.", 401, "unsigned");
    }
    const nonce = verifyNonce(body.nonce, secret, { purpose: "label", address: addr });
    const expected = labelMessageFromBody(addr, body.candidate, body.verdict, body.note, body.nonce, isoFromUnix(nonce.exp));
    if (body.message !== expected) {
      throw new AuthError("Signed message does not match this request.", 403, "message_mismatch");
    }
    await verifySignedMessage({ message: body.message, signature: body.signature, address: addr });
    const res = await rememberLabel(memory, cfg.memwalNamespacePrefix, addr, body.candidate, body.verdict, body.note, {
      proof: { signature: body.signature, signedAt: new Date().toISOString() },
    });
    return Response.json({ ...res, store: memory.kind, demo: false });
  } catch (e) {
    return jsonError(e);
  }
}
