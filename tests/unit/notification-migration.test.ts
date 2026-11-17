import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

it("upgrades an existing board without changing its tasks or revision", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(readFileSync("migrations/0001_shared_board.sql", "utf8"));
    db.exec(readFileSync("migrations/0002_partner_revision.sql", "utf8"));
    db.exec("INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)");
    db.exec("INSERT INTO tasks VALUES ('task','Tarea','a','todo','2026-01-01T00:00:00.000Z','2025-01-01','2025-01-01')");
    db.exec("UPDATE board_metadata SET revision=42");
    const before = db.prepare("SELECT * FROM tasks").all();
    db.exec(readFileSync("migrations/0003_task_notifications.sql", "utf8"));
    expect(db.prepare("SELECT * FROM tasks").all()).toEqual(before);
    expect(db.prepare("SELECT revision FROM board_metadata").get()?.revision).toBe(42);
    expect(db.prepare("SELECT task_id, deadline FROM notification_deadlines").get()).toMatchObject({ task_id: "task", deadline: "2026-01-01T00:00:00.000Z" });
  } finally {
    db.close();
  }
});
