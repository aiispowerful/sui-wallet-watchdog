import { describe, expect, it } from "vitest";
import { integrationStatus } from "@/lib/server";

describe("GET /api/status payload", () => {
  it("does not leak WATCH_ADDRESS / defaultAddress to the client", () => {
    const prev = process.env.WATCH_ADDRESS;
    process.env.WATCH_ADDRESS = "0x" + "aa".repeat(32);
    try {
      const status = integrationStatus();
      expect(status).not.toHaveProperty("defaultAddress");
      expect(JSON.stringify(status)).not.toContain(process.env.WATCH_ADDRESS);
    } finally {
      if (prev === undefined) delete process.env.WATCH_ADDRESS;
      else process.env.WATCH_ADDRESS = prev;
    }
  });
});
