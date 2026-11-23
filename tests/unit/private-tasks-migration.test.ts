import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

it("upgrades shared tasks and enforces private ownership and revision backfill", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const migration of [
      "0001_shared_board",
      "0002_partner_revision",
      "0003_task_notifications",
    ]) {
      db.exec(readFileSync(`migrations/${migration}.sql`, "utf8"));
    }
    db.exec("INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)");
    db.exec(
      "INSERT INTO tasks VALUES ('shared','Tarea','a','todo',NULL,'2025','2025')",
    );
    db.exec("UPDATE board_metadata SET revision=42");
    db.exec(readFileSync("migrations/0004_private_tasks.sql", "utf8"));
    expect(
      db
        .prepare("SELECT visibility, creator_uid FROM tasks WHERE id='shared'")
        .get(),
    ).toMatchObject({ visibility: "shared", creator_uid: null });
    expect(
      db
        .prepare(
          "SELECT revision, slot_1_revision, slot_2_revision FROM board_metadata",
        )
        .get(),
    ).toMatchObject({ revision: 42, slot_1_revision: 42, slot_2_revision: 42 });
    expect(() =>
      db.exec(
        "INSERT INTO tasks (id,title,assignee_uid,status,created_at,updated_at,visibility,creator_uid) VALUES ('bad','Tarea','b','todo','2025','2025','private','a')",
      ),
    ).toThrow();
    db.exec(
      "INSERT INTO tasks (id,title,assignee_uid,status,created_at,updated_at,visibility,creator_uid) VALUES ('private','Tarea','a','todo','2025','2025','private','a')",
    );
    expect(() =>
      db.exec("UPDATE tasks SET visibility='shared' WHERE id='private'"),
    ).toThrow();
    expect(() =>
      db.exec("UPDATE tasks SET assignee_uid='b' WHERE id='private'"),
    ).toThrow();
    db.exec("UPDATE partners SET display_name='Ana nueva' WHERE slot=1");
    expect(
      db
        .prepare(
          "SELECT revision, slot_1_revision, slot_2_revision FROM board_metadata",
        )
        .get(),
    ).toMatchObject({ revision: 43, slot_1_revision: 43, slot_2_revision: 43 });
  } finally {
    db.close();
  }
});
