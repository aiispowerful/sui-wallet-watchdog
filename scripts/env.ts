/** Load .env.local / .env for CLI scripts (Next.js loads them itself for the app). */
import { existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}
