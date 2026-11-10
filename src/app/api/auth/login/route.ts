import { z } from "zod";
import { AddressSchema, jsonError, scopeAddress } from "@/lib/api";
import { cookieSecureFlag, requestDomain, serializeSessionCookie } from "@/lib/auth/cookies";
import { AuthError } from "@/lib/auth/errors";
import { buildLoginMessage } from "@/lib/auth/messages";
import { verifyNonce } from "@/lib/auth/nonce";
import { getSessionSecret } from "@/lib/auth/secret";
import { issueSession } from "@/lib/auth/session";
import { isoFromUnix } from "@/lib/auth/token";
import { verifySignedMessage } from "@/lib/auth/verify-message";

const Body = z.object({
  address: AddressSchema,
  nonce: z.string().min(1).max(4000),
  message: z.string().min(1).max(4000),
  signature: z.string().min(1).max(8000),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const address = scopeAddress(body.address);
    const secret = getSessionSecret();
    const domain = requestDomain(req);
    const nonce = verifyNonce(body.nonce, secret, { purpose: "login", address, domain });
    const expected = buildLoginMessage({
      domain: nonce.dom ?? domain,
      address,
      nonce: body.nonce,
      issuedAt: isoFromUnix(nonce.iat),
      expiresAt: isoFromUnix(nonce.exp),
    });
    if (body.message !== expected) {
      throw new AuthError("Signed message does not match this sign-in challenge.", 403, "message_mismatch");
    }
    const signed = await verifySignedMessage({ message: body.message, signature: body.signature, address });
    const session = issueSession(signed.address, secret);
    const res = Response.json({ address: signed.address, expiresAt: session.expiresAt });
    res.headers.set("Set-Cookie", serializeSessionCookie(session.token, { maxAge: session.maxAge, secure: cookieSecureFlag(req) }));
    return res;
  } catch (e) {
    return jsonError(e);
  }
}

