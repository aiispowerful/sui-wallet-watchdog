import { clearSessionCookie } from "@/lib/auth/cookies";
import { cookieSecureFlag } from "@/lib/auth/http";

export async function POST(req: Request) {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie(cookieSecureFlag(req)));
  return res;
}
