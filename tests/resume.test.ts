import { describe, expect, it } from "vitest";
import { latchResume, settleResume } from "@/lib/auth/resume";

const ADDR = "0x" + "ab".repeat(32);
const ADDR2 = "0x" + "cd".repeat(32);

describe("settleResume", () => {
  it("waits until the session lookup has finished", () => {
    expect(
      settleResume({ sessionReady: false, connectionStatus: "disconnected", sessionAddress: ADDR }),
    ).toEqual({ ready: false, address: null });
  });

  it("waits while the wallet is autoconnecting", () => {
    expect(
      settleResume({
        sessionReady: true,
        connectionStatus: "reconnecting",
        accountAddress: ADDR,
        sessionAddress: ADDR,
      }),
    ).toEqual({ ready: false, address: null });
  });

  it("returns no address on a fresh landing", () => {
    expect(settleResume({ sessionReady: true, connectionStatus: "disconnected" })).toEqual({
      ready: true,
      address: null,
    });
  });

  it("prefers the connected wallet over the session cookie", () => {
    expect(
      settleResume({
        sessionReady: true,
        connectionStatus: "connected",
        accountAddress: ADDR,
        sessionAddress: ADDR2,
      }),
    ).toEqual({ ready: true, address: ADDR });
  });

  it("uses the session cookie when no wallet is connected", () => {
    expect(
      settleResume({
        sessionReady: true,
        connectionStatus: "disconnected",
        sessionAddress: ADDR2,
      }),
    ).toEqual({ ready: true, address: ADDR2 });
  });

  it("does not treat a later user-initiated connecting state as first-load restore", () => {
    expect(
      settleResume({ sessionReady: true, connectionStatus: "connecting" }),
    ).toEqual({ ready: true, address: null });
  });
});

describe("latchResume", () => {
  it("latches the first settled snapshot so a later connect does not open the prompt", () => {
    const waiting = latchResume(null, { ready: false, address: null });
    expect(waiting).toBeNull();
    const none = latchResume(waiting, { ready: true, address: null });
    expect(none).toEqual({ ready: true, address: null });
    const later = latchResume(none, { ready: true, address: ADDR });
    expect(later).toEqual({ ready: true, address: null });
  });

  it("latches a restored address from the first settled snapshot", () => {
    const prompt = latchResume(null, { ready: true, address: ADDR });
    expect(prompt).toEqual({ ready: true, address: ADDR });
    expect(latchResume(prompt, { ready: true, address: null })).toEqual({ ready: true, address: ADDR });
  });
});
