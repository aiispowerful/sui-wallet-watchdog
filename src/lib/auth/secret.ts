import "server-only";

export function getSessionSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.SESSION_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (need at least 16 characters).");
  }
  return s;
}
