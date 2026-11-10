import { z } from "zod";
import { rememberPreference } from "@/lib/agent/learn";
import { AddressSchema, jsonError, scopeAddress } from "@/lib/api";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/http";
import { buildPreferenceMessage } from "@/lib/auth/messages";
import { verifyNonce } from "@/lib/auth/nonce";
import { getSessionSecret } from "@/lib/auth/secret";
import { isoFromUnix } from "@/lib/auth/token";
import { verifySignedMessage } from "@/lib/auth/verify-message";
import { getDeps } from "@/lib/server";

export const maxDuration = 60;

const Body = z
  .object({
    address: AddressSchema,
    minOutflowSui: z.number().min(0).max(1e9).optional(),
    note: z.string().max(500).optional(),
    nonce: z.string().min(1).max(4000).optional(),
    message: z.string().min(1).max(4000).optional(),
    signature: z.string().min(1).max(8000).optional(),
  })
  .refine((b) => b.minOutflowSui !== undefined || (b.note && b.note.trim()), "Provide a threshold or a note");

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const { memory, cfg } = getDeps();
    const addr = scopeAddress(body.address);

    const secret = getSessionSecret();
    requireSession(req, addr, secret);
    if (!body.nonce || !body.message || !body.signature) {
      throw new AuthError("A wallet signature is required to save this preference.", 401, "unsigned");
    }
    const nonce = verifyNonce(body.nonce, secret, { purpose: "preference", address: addr });
    const expected = buildPreferenceMessage({
      address: addr,
      minOutflowSui: body.minOutflowSui,
      note: body.note,
      nonce: body.nonce,
      expiresAt: isoFromUnix(nonce.exp),
    });
    if (body.message !== expected) {
      throw new AuthError("Signed message does not match this request.", 403, "message_mismatch");
    }
    await verifySignedMessage({ message: body.message, signature: body.signature, address: addr });
    const res = await rememberPreference(memory, cfg.memwalNamespacePrefix, addr, {
      minOutflowSui: body.minOutflowSui,
      note: body.note,
      proof: { signature: body.signature, signedAt: new Date().toISOString() },
    });
    return Response.json({ ...res, store: memory.kind });
  } catch (e) {
    return jsonError(e);
  }
}
