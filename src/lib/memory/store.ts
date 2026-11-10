/**
 * Memory store backed by Walrus Memory (MemWal SDK, `@mysten-incubation/memwal`).
 *
 * - Production: `MemWal.create({ key, accountId, serverUrl, namespace })` — the relayer embeds,
 *   SEAL-encrypts and uploads each memory to Walrus mainnet and indexes it for semantic recall.
 * - Local dev / tests (no MEMWAL_KEY): `MemWalMock`, the SDK's own in-memory implementation with
 *   the identical API, kept on globalThis so memories survive across requests in `next dev`.
 */
import { MemWal, MemWalMock, MemWalRememberJobTimeoutError } from "@mysten-incubation/memwal";
import type { AppConfig } from "../config";
import { hasMemWal } from "../config";
import type { RecalledMemory } from "../types";
import { parseMemory } from "./format";

type MemWalLike = Pick<MemWal, "remember" | "waitForRememberJob" | "recall" | "rememberBulk" | "waitForRememberJobs" | "health">;

export interface StoredMemory {
  jobId: string;
  blobId?: string;
  status: "done" | "pending";
}

export interface MemoryStore {
  readonly kind: "walrus-mainnet" | "mock";
  remember(text: string, namespace: string, opts?: { wait?: boolean; timeoutMs?: number }): Promise<StoredMemory>;
  rememberMany(texts: string[], namespace: string): Promise<StoredMemory[]>;
  recall(query: string, namespace: string, topK?: number): Promise<RecalledMemory[]>;
  health(): Promise<unknown>;
}

export class MemWalStore implements MemoryStore {
  constructor(
    private readonly client: MemWalLike,
    readonly kind: "walrus-mainnet" | "mock",
  ) {}

  async remember(text: string, namespace: string, opts: { wait?: boolean; timeoutMs?: number } = {}): Promise<StoredMemory> {
    // remember() is async on the relayer: it returns a job id immediately; the blob id
    // exists once the encrypted blob is uploaded to Walrus and indexed.
    const accepted = await this.client.remember(text, namespace);
    if (opts.wait === false) return { jobId: accepted.job_id, status: "pending" };
    try {
      const done = await this.client.waitForRememberJob(accepted.job_id, { timeoutMs: opts.timeoutMs ?? 45_000 });
      return { jobId: accepted.job_id, blobId: done.blob_id, status: "done" };
    } catch (e) {
      // Timeout waiting is not a failed write — the relayer keeps processing the job.
      if (e instanceof MemWalRememberJobTimeoutError) return { jobId: accepted.job_id, status: "pending" };
      throw e;
    }
  }

  async rememberMany(texts: string[], namespace: string): Promise<StoredMemory[]> {
    const accepted = await this.client.rememberBulk(texts.map((text) => ({ text, namespace })));
    const res = await this.client.waitForRememberJobs(accepted.job_ids, accepted.job_ids.map(() => namespace), { timeoutMs: 180_000 });
    return res.results.map((r) => ({ jobId: r.id, blobId: r.blob_id, status: r.status === "done" ? "done" : "pending" }));
  }

  async recall(query: string, namespace: string, topK = 10): Promise<RecalledMemory[]> {
    const r = await this.client.recall({ query, namespace, limit: topK });
    return r.results.map((m) => ({ blobId: m.blob_id, text: m.text, distance: m.distance, createdAt: m.created_at, parsed: parseMemory(m.text) }));
  }

  health() {
    return this.client.health();
  }
}

const g = globalThis as unknown as { __watchdogMock?: MemWalMock; __watchdogStore?: MemoryStore };

export function createMemoryStore(cfg: AppConfig): MemoryStore {
  if (hasMemWal(cfg)) {
    if (!g.__watchdogStore || g.__watchdogStore.kind !== "walrus-mainnet") {
      const client = MemWal.create({
        key: cfg.memwalKey!,
        accountId: cfg.memwalAccountId!,
        serverUrl: cfg.memwalServerUrl,
        namespace: cfg.memwalNamespacePrefix,
      });
      g.__watchdogStore = new MemWalStore(client, "walrus-mainnet");
    }
    return g.__watchdogStore;
  }
  g.__watchdogMock ??= MemWalMock.create({ namespace: cfg.memwalNamespacePrefix, owner: "local-mock" });
  return new MemWalStore(g.__watchdogMock as unknown as MemWalLike, "mock");
}
