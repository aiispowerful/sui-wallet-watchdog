/** Address / coin-type normalisation so Tatum JSON-RPC and GraphQL data compare equal. */

const HEX = /^0x[0-9a-fA-F]{1,64}$/;

export function isSuiAddress(value: string): boolean {
  return HEX.test(value.trim());
}

export function normalizeAddress(value: string): string {
  const v = value.trim().toLowerCase();
  if (!HEX.test(v)) throw new Error(`Invalid Sui address: ${value}`);
  return "0x" + v.slice(2).padStart(64, "0");
}

/** `0x000…02::sui::SUI` → `0x2::sui::SUI` (short form for well-known framework addresses). */
export function normalizeCoinType(coinType: string): string {
  const [addr, ...rest] = coinType.split("::");
  if (!addr || rest.length === 0) return coinType;
  const hex = addr.toLowerCase().replace(/^0x/, "").replace(/^0+/, "") || "0";
  const full = hex.length <= 1 ? "0x" + hex : "0x" + hex.padStart(64, "0");
  return [full, ...rest].join("::");
}

export function shortAddress(addr: string): string {
  if (!addr.startsWith("0x") || addr.length < 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** `0xabc::coin::FOO` → `FOO` */
export function coinSymbolFromType(coinType: string): string {
  const parts = coinType.split("::");
  return parts[parts.length - 1] || coinType;
}

export function toHuman(raw: string | number | bigint, decimals: number): number {
  const n = typeof raw === "bigint" ? raw : BigInt(String(raw));
  const neg = n < BigInt(0);
  const abs = neg ? -n : n;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = Number(abs / base);
  const frac = Number(abs % base) / Number(base);
  return (neg ? -1 : 1) * (whole + frac);
}

/** Package ids: framework packages (0x1, 0x2, 0x3) in short form, others padded to 64 hex chars. */
export function normalizePackageId(pkg: string): string {
  return normalizeCoinType(`${pkg}::m::T`).split("::")[0];
}
