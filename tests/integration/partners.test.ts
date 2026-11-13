import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { authorizePartner, listPartners } from "../../src/worker/partners";

describe("partner authorization", () => {
  it("requires both fixed slots, denies outsiders and disabled partners", async () => {
    await expect(authorizePartner(env.DB, "a")).rejects.toMatchObject({
      status: 503,
    });
    await env.DB.prepare(
      "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
    ).run();
    await expect(authorizePartner(env.DB, "a")).resolves.toBeUndefined();
    await expect(authorizePartner(env.DB, "outsider")).rejects.toMatchObject({
      status: 403,
    });
    expect(await listPartners(env.DB)).toEqual([
      { uid: "a", displayName: "Ana" },
      { uid: "b", displayName: "Bea" },
    ]);
    await env.DB.prepare("UPDATE partners SET enabled=0 WHERE uid='b'").run();
    await expect(authorizePartner(env.DB, "b")).rejects.toMatchObject({
      status: 403,
    });
    expect(await listPartners(env.DB)).toEqual([
      { uid: "a", displayName: "Ana" },
    ]);
    expect(
      (
        await env.DB.prepare(
          "SELECT revision FROM board_metadata WHERE id=1",
        ).first<{ revision: number }>()
      )?.revision,
    ).toBe(1);
  });
});
