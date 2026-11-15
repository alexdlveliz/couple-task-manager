import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { eventSelectionSql } from "../../src/worker/task-notification-events";

it("classifies creation, covered edits, completion and mixed saves for both actors", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE partners(uid TEXT,enabled INTEGER); INSERT INTO partners VALUES ('a',1),('b',1); CREATE TABLE tasks(id TEXT,title TEXT,assignee_uid TEXT,status TEXT,deadline TEXT); INSERT INTO tasks VALUES ('t','Antes','a','todo',NULL); CREATE TABLE board_metadata(id INTEGER,revision INTEGER); INSERT INTO board_metadata VALUES (1,0)",
  );
  const select = db.prepare(eventSelectionSql);
  const run = (actor: string, data: object, creating = false) =>
    select.all(
      JSON.stringify({
        id: "t",
        actor,
        now: "2026-01-01T00:00:00.000Z",
        eventId: "event",
        creating,
        ...data,
      }),
    ) as { type: string; recipient_uid: string; payload: string }[];
  const base = {
    title: "Antes",
    assigneeUid: "a",
    status: "todo",
    deadline: null,
  };
  for (const actor of ["a", "b"]) {
    expect(run(actor, base, true).map((r) => r.recipient_uid)).toEqual([
      "a",
      "b",
    ]);
    expect(run(actor, base)).toEqual([]);
    for (const change of [
      { title: "Después" },
      { assigneeUid: "b" },
      { status: "blocked" },
      { deadline: "2027-01-01T00:00:00Z" },
    ]) {
      const rows = run(actor, { ...base, ...change });
      expect(rows.map((r) => [r.type, r.recipient_uid])).toEqual([
        ["changed", actor === "a" ? "b" : "a"],
      ]);
    }
    const rows = run(actor, { ...base, status: "completed", title: "Después" });
    expect(rows.map((r) => r.type)).toEqual(["completed", "completed"]);
    expect(
      (
        JSON.parse(
          rows.find((r) => r.recipient_uid === actor)?.payload ?? "{}",
        ) as { body: string }
      ).body,
    ).not.toContain("título");
    expect(
      (
        JSON.parse(
          rows.find((r) => r.recipient_uid !== actor)?.payload ?? "{}",
        ) as { body: string }
      ).body,
    ).toContain("título");
  }
  db.close();
});
