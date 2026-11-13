import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("keeps a durable cleanup marker when localStorage writes and IndexedDB cleanup both fail", async () => {
  const values = new Map<string, string>();
  const cookie = {
    get cookie() {
      return [...values].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      const [pair, ...attributes] = value.split(";");
      const [key, content] = pair.split("=");
      if (attributes.some((item) => item.trim() === "Max-Age=0"))
        values.delete(key);
      else values.set(key, content);
    },
  };
  vi.stubGlobal("document", cookie);
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("localStorage", {
    setItem() {
      throw new DOMException("full", "QuotaExceededError");
    },
    getItem() {
      return null;
    },
    removeItem() {},
  });
  const { readSnapshot } = await import("../../src/client/snapshot-store");
  await readSnapshot("project", "existing");
  const transaction = vi
    .spyOn(IDBDatabase.prototype, "transaction")
    .mockImplementation(() => {
      throw new DOMException("unavailable", "QuotaExceededError");
    });
  const first = await import("../../src/client/session-invalidation");
  await expect(first.invalidatePrivateData("partner-a")).rejects.toThrow();
  expect(first.restorationAllowed("partner-a")).toBe(false);
  vi.resetModules();
  const reloaded = await import("../../src/client/session-invalidation");
  expect(reloaded.restorationAllowed("partner-a")).toBe(false);
  expect(reloaded.restorationAllowed("partner-b")).toBe(true);
  transaction.mockRestore();
  await reloaded.invalidatePrivateData("partner-a");
  expect(reloaded.restorationAllowed("partner-a")).toBe(true);
});
it("blocks restoration in the active tab when every cleanup marker is unavailable", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("document", {
    get cookie() {
      throw new Error("cookies unavailable");
    },
    set cookie(_value: string) {
      throw new Error("cookies unavailable");
    },
  });
  vi.stubGlobal("localStorage", {
    setItem() {
      throw new Error("storage unavailable");
    },
    getItem() {
      return null;
    },
    removeItem() {},
  });
  const { readSnapshot } = await import("../../src/client/snapshot-store");
  await readSnapshot("project", "existing");
  vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(() => {
    throw new Error("database unavailable");
  });
  const session = await import("../../src/client/session-invalidation");
  await expect(session.invalidatePrivateData("partner-a")).rejects.toThrow();
  expect(session.restorationAllowed("partner-a")).toBe(false);
});
