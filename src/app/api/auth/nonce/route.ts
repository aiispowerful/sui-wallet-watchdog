import { z } from "zod";
import { AddressSchema, isDemoWallet, jsonError, scopeAddress } from "@/lib/api";
import { requestDomain } from "@/lib/auth/cookies";
import { requireSession } from "@/lib/auth/http";
import { buildLoginMessage } from "@/lib/auth/messages";
import { issueNonce, type NoncePurpose } from "@/lib/auth/nonce";
import { getSessionSecret } from "@/lib/auth/secret";

const Body = z.object({
  purpose: z.enum(["login", "label", "preference"]),
  address: AddressSchema.optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const secret = getSessionSecret();
    const domain = requestDomain(req);
    if (body.purpose === "login") {
      const address = body.address && !isDemoWallet(body.address) ? scopeAddress(body.address) : undefined;
      const issued = issueNonce(secret, { purpose: "login", address, domain });
      const message = address
        ? buildLoginMessage({ domain, address, nonce: issued.nonce, issuedAt: issued.issuedAt, expiresAt: issued.expiresAt })
        : undefined;
      return Response.json({ ...issued, domain, address, message });
    }
    if (!body.address) {
      return Response.json({ error: "Address is required for this nonce." }, { status: 400 });
    }
    const address = scopeAddress(body.address);
    requireSession(req, address, secret);
    const issued = issueNonce(secret, { purpose: body.purpose as NoncePurpose, address, domain });
    return Response.json({ ...issued, domain, address });
  } catch (e) {
    return jsonError(e);
  }
}
