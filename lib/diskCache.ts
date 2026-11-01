import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Results from rehearsal survive a restart, so the stage demo is instant and costs nothing.
// On Cloudflare they live in the SECOND_EAR_CACHE KV namespace; locally, on disk in .cache/.
const DIR = path.join(process.cwd(), ".cache");

type KV = {
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  put(key: string, value: ArrayBuffer | string): Promise<void>;
};

function kv(): KV | null {
  try {
    return (getCloudflareContext().env as { SECOND_EAR_CACHE?: KV }).SECOND_EAR_CACHE ?? null;
  } catch {
    return null; // not running on Cloudflare (e.g. `npm run dev`)
  }
}

function hash(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

function file(ns: string, key: string, ext: string) {
  return path.join(DIR, ns, `${hash(key)}.${ext}`);
}

export async function readCache(ns: string, key: string, ext: string): Promise<Buffer | null> {
  const store = kv();
  if (store) {
    try {
      const buf = await store.get(`${ns}/${hash(key)}.${ext}`, "arrayBuffer");
      return buf ? Buffer.from(buf) : null;
    } catch {
      return null;
    }
  }
  try {
    return readFileSync(file(ns, key, ext));
  } catch {
    return null;
  }
}

export async function writeCache(ns: string, key: string, ext: string, data: Buffer | string) {
  const store = kv();
  if (store) {
    try {
      await store.put(
        `${ns}/${hash(key)}.${ext}`,
        typeof data === "string" ? data : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer),
      );
    } catch (e) {
      console.warn("[cache] KV write failed:", e instanceof Error ? e.message : e);
    }
    return;
  }
  try {
    const f = file(ns, key, ext);
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, data);
  } catch {
    // Read-only filesystems just skip the disk cache.
  }
}
