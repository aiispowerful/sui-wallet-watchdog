import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { normalizeAddress } from "../sui/normalize";
import { AuthError } from "./errors";

/**
 * Verify a Sui personal message signature (Ed25519, zkLogin, multisig, passkey,
 * secp256k1/r1 — whatever verifyPersonalMessageSignature supports) and return
 * the signer's Sui address.
 */
export async function verifySignedMessage(opts: {
  message: string;
  signature: string;
  address: string;
}): Promise<{ address: string }> {
  const expected = normalizeAddress(opts.address);
  const bytes = new TextEncoder().encode(opts.message);
  let publicKey;
  try {
    publicKey = await verifyPersonalMessageSignature(bytes, opts.signature, { address: expected });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/address/i.test(msg)) throw new AuthError("Signature does not match this address.", 403, "mismatch");
    throw new AuthError("Signature is not valid for this message.", 403, "bad_signature");
  }
  const signer = normalizeAddress(publicKey.toSuiAddress());
  if (signer !== expected) throw new AuthError("Signature does not match this address.", 403, "mismatch");
  return { address: signer };
}
