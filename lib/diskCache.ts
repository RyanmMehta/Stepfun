import "server-only";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Results from rehearsal survive a server restart, so the stage demo is instant and costs nothing.
const DIR = path.join(process.cwd(), ".cache");

function file(ns: string, key: string, ext: string) {
  const h = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return path.join(DIR, ns, `${h}.${ext}`);
}

export function readCache(ns: string, key: string, ext: string): Buffer | null {
  try {
    return readFileSync(file(ns, key, ext));
  } catch {
    return null;
  }
}

export function writeCache(ns: string, key: string, ext: string, data: Buffer | string) {
  try {
    const f = file(ns, key, ext);
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, data);
  } catch {
    // Read-only filesystems (e.g. serverless) just skip the disk cache.
  }
}
