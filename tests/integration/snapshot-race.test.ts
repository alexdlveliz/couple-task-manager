import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { createTask } from "../../src/worker/tasks";
import worker from "../../src/worker/local";
const encode = (v: unknown) => btoa(JSON.stringify(v)).replace(/=/g, "");
it("returns a snapshot and revision from the same read batch after a concurrent save", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
  ).run();
  await createTask(env.DB, "a", {
    title: "Primera",
    assigneeUid: "a",
    deadline: null,
  });
  const now = Math.floor(Date.now() / 1000);
  const token = `${encode({ alg: "none" })}.${encode({ sub: "a", aud: "demo-shared-task-board", iss: "https://securetoken.google.com/demo-shared-task-board", iat: now, auth_time: now, exp: now + 3600 })}.`;
  let raced = false;
  const db = {
    prepare(query: string) {
      const statement = env.DB.prepare(query);
      if (query === "SELECT revision FROM board_metadata WHERE id=1")
        return new Proxy(statement, {
          get(target, property) {
            if (property === "first")
              return async () => {
                const revision = await target.first();
                if (!raced) {
                  raced = true;
                  await createTask(env.DB, "b", {
                    title: "Segunda",
                    assigneeUid: "b",
                    deadline: null,
                  });
                }
                return revision;
              };
            const value: unknown = Reflect.get(target, property);
            if (typeof value !== "function") return value;
            const bound: unknown = Reflect.apply(
              // eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.apply supplies the function receiver explicitly.
              Function.prototype.bind,
              value,
              [target],
            );
            return bound;
          },
        });
      return statement;
    },
    batch: env.DB.batch.bind(env.DB),
  } as unknown as D1Database;
  const local = {
    ...env,
    DB: db,
    AUTH_MODE: "emulator" as const,
    ENVIRONMENT: "local",
    FIREBASE_PROJECT_ID: "demo-shared-task-board",
  };
  const response = await worker.fetch(
    new Request("https://example.test/api/tasks", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    local,
  );
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- The project typecheck treats Response.json as unknown in this fixture.
  const board = (await response.json()) as {
    revision: number;
    tasks: unknown[];
  };
  expect(board.revision).toBe(2);
  expect(board.tasks).toHaveLength(2);
  expect(response.headers.get("ETag")).toBe('"board-r2"');
});
