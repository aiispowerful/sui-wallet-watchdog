import { jsonError } from "@/lib/api";
import { trySession } from "@/lib/auth/http";
import { getSessionSecret } from "@/lib/auth/secret";

export async function GET(req: Request) {
  try {
    const session = trySession(req, getSessionSecret());
    if (!session) return Response.json({ address: null });
    return Response.json({ address: session.addr, expiresAt: session.exp * 1000 });
  } catch (e) {
    return jsonError(e);
  }
}
