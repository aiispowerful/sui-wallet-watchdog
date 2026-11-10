export function walletErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancelled|canceled|user abort/i.test(msg)) {
    return "You rejected the signature in your wallet.";
  }
  if (/expired/i.test(msg)) return "This approval expired. Please try again.";
  if (/mismatch|different address|does not match/i.test(msg)) {
    return "That signature does not match the signed-in wallet. Check the connected address and try again.";
  }
  return msg;
}
