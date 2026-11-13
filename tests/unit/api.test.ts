import { afterEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { createApi } from "../../src/client/api";
const user = { getIdToken: () => Promise.resolve("token") } as User;
afterEach(() => vi.restoreAllMocks());
it("rejects non-JSON and structurally invalid successful responses", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response("<html>failure</html>", { status: 200 }),
    )
    .mockResolvedValueOnce(
      Response.json({ tasks: "not-an-array", revision: 0 }),
    );
  const api = createApi(user, () => {});
  await expect(api.board()).rejects.toThrow();
  await expect(api.board()).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("notifies the session owner on definitive rejection", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: { message: "denied" } }, { status: 403 }),
  );
  const rejected = vi.fn();
  await expect(createApi(user, rejected).partners()).rejects.toThrow();
  expect(rejected).toHaveBeenCalledOnce();
});
it("times out when token refresh stalls before the fetch starts", async () => {
  vi.useFakeTimers();
  const stalled = { getIdToken: () => new Promise<string>(() => {}) } as User;
  const pending = createApi(stalled, () => {}).board();
  const result = expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(10_001);
  await result;
  vi.useRealTimers();
});
it("aborts an in-flight request when its session is invalidated", async () => {
  const session = new AbortController();
  let captured: AbortSignal | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        captured = init?.signal as AbortSignal;
        captured.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  );
  const request = createApi(user, () => {}, session.signal).board();
  await vi.waitFor(() => {
    expect(captured).toBeDefined();
  });
  session.abort();
  await expect(request).rejects.toThrow();
  expect(captured?.aborted).toBe(true);
});
it("cancels even when session changes while token refresh is stalled", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const pending = createApi(
    { getIdToken: () => new Promise<string>(() => {}) } as User,
    () => {},
    controller.signal,
  ).board();
  const result = expect(pending).rejects.toThrow();
  controller.abort();
  await vi.advanceTimersByTimeAsync(1);
  await result;
  vi.useRealTimers();
});
it("accepts a 304 only when it verifies the requested complete snapshot", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(null, { status: 304, headers: { ETag: '"board-r6"' } }),
    )
    .mockResolvedValueOnce(
      new Response(null, { status: 304, headers: { ETag: '"board-r5"' } }),
    )
    .mockResolvedValueOnce(
      new Response(null, { status: 304, headers: { ETag: '"board-r5"' } }),
    );
  const api = createApi(user, () => {});
  await expect(api.board(5)).rejects.toThrow();
  await expect(api.board()).rejects.toThrow();
  await expect(api.board(5)).resolves.toBeNull();
});
it("rejects a full board whose ETag does not match its revision", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      { tasks: [], revision: 2 },
      { headers: { ETag: '"board-r1"' } },
    ),
  );
  await expect(createApi(user, () => {}).board()).rejects.toThrow();
});
it("accepts weak ETags for a matching board and conditional response", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json(
        { tasks: [], revision: 2 },
        { headers: { ETag: 'W/"board-r2"' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(null, { status: 304, headers: { ETag: 'W/"board-r2"' } }),
    );
  const api = createApi(user, () => {});
  await expect(api.board()).resolves.toEqual({ tasks: [], revision: 2 });
  await expect(api.board(2)).resolves.toBeNull();
});
it.each([undefined, 'W/"board-r1"', 'w/"board-r2"', 'W/"board-r02"'])(
  "rejects missing, mismatched, or malformed board ETag %s",
  async (tag) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { tasks: [], revision: 2 },
        { headers: tag ? { ETag: tag } : {} },
      ),
    );
    await expect(createApi(user, () => {}).board()).rejects.toThrow();
  },
);
