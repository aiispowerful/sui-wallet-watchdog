/**
 * First-load resume of a wallet or session address.
 *
 * Autoconnect and the session cookie can restore an address after reload.
 * The UI must not prefill or show results until the user confirms.
 * A typed address with no wallet/session is never persisted (no localStorage,
 * sessionStorage, or URL) and therefore disappears on reload on its own.
 */

export type ConnectionStatus = "disconnected" | "connecting" | "reconnecting" | "connected";

export interface ResumeSnapshot {
  /** False while we still expect autoconnect or /api/auth/me to settle. */
  ready: boolean;
  address: string | null;
}

export function settleResume(opts: {
  sessionReady: boolean;
  connectionStatus: string;
  accountAddress?: string | null;
  sessionAddress?: string | null;
}): ResumeSnapshot {
  if (!opts.sessionReady) return { ready: false, address: null };
  // Autoconnect uses "reconnecting". Do not treat a later user-initiated
  // "connecting" as part of first-load restore — only block while reconnecting.
  if (opts.connectionStatus === "reconnecting") return { ready: false, address: null };
  const account = opts.accountAddress?.trim() || null;
  const session = opts.sessionAddress?.trim() || null;
  return { ready: true, address: account ?? session };
}

/** Keep the first settled snapshot so a later connect does not open the prompt. */
export function latchResume(prev: ResumeSnapshot | null, next: ResumeSnapshot): ResumeSnapshot | null {
  if (prev) return prev;
  if (!next.ready) return null;
  return next;
}
