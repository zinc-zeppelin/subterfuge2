import fs from "fs";
import os from "os";
import path from "path";
import { GameStore } from "@/lib/store/game-store";

export interface TestStoreContext {
  store: GameStore;
  tempDir: string;
  cleanup: () => void;
}

/**
 * Creates an isolated, local file-backed GameStore instance in a temporary folder.
 * Guaranteed to run in pure memory/local disk without touching live Upstash Redis.
 */
export function createTestStore(): TestStoreContext {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "subterfuge-unit-"));
  const store = new GameStore(tempDir, null);

  const cleanup = () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  };

  return { store, tempDir, cleanup };
}

export function createIsolatedGameStore(): { store: GameStore; testDir: string } {
  const { store, tempDir } = createTestStore();
  return { store, testDir: tempDir };
}

export function cleanupIsolatedStore(testDir: string): void {
  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup errors
  }
}
