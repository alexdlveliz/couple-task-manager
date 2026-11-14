import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Board } from "../../src/client/Board";

describe("shared task list", () => {
  it("offers filters and a direct status control for each task", () => {
    const html = renderToStaticMarkup(
      createElement(Board, {
        tasks: [
          {
            id: "1",
            title: "Comprar pan",
            assigneeUid: "a",
            status: "todo",
            deadline: null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
        partners: [{ uid: "a", displayName: "Ana" }],
        offline: false,
        busy: false,
        onCreate: vi.fn(),
        onEdit: vi.fn(),
        onStatusChange: vi.fn(),
      }),
    );
    expect(html).toContain("<legend>Estado</legend>");
    expect(html).toContain("<legend>Responsable</legend>");
    expect(html).toContain('aria-label="Cambiar estado: Comprar pan"');
  });
});

import { groupTasks, summarizeTasks } from "../../src/client/board-view";
import type { Task } from "../../src/shared/contracts";

const task = (
  id: string,
  deadline: string | null,
  status: Task["status"] = "todo",
): Task => ({
  id,
  title: id,
  assigneeUid: "a",
  status,
  deadline,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("daily board derivation", () => {
  it("groups by local calendar date, preserving order and completed precedence", () => {
    const tasks = [
      task("future", "2026-03-10T06:00:00Z"),
      task("old", "2026-03-08T05:00:00Z"),
      task("today", "2026-03-09T05:00:00Z", "blocked"),
      task("none", null),
      task("done", "2026-03-01T00:00:00Z", "completed"),
      task("old2", "2026-03-07T00:00:00Z"),
    ];
    const groups = groupTasks(
      tasks,
      "2026-03-09T12:00:00Z",
      "America/New_York",
    );
    expect(groups.map((g) => [g.label, g.tasks.map((t) => t.id)])).toEqual([
      ["Vencidas", ["old", "old2"]],
      ["Hoy", ["today"]],
      ["Próximas", ["future"]],
      ["Sin fecha", ["none"]],
      ["Completadas", ["done"]],
    ]);
    expect(
      summarizeTasks(tasks, "2026-03-09T12:00:00Z", "America/New_York"),
    ).toEqual({ today: 1, inProgress: 0 });
  });
  it("changes groups at local midnight and counts progress independently", () => {
    const tasks = [
      task("x", "2026-11-01T05:30:00Z", "in_progress"),
      task("done", "2026-11-01T06:30:00Z", "completed"),
    ];
    expect(
      groupTasks(tasks, "2026-11-01T03:59:00Z", "America/New_York").map(
        (g) => g.key,
      ),
    ).toEqual(["upcoming", "completed"]);
    expect(
      groupTasks(tasks, "2026-11-01T04:00:00Z", "America/New_York").map(
        (g) => g.key,
      ),
    ).toEqual(["today", "completed"]);
    expect(
      summarizeTasks(tasks, "2026-11-01T04:00:00Z", "America/New_York"),
    ).toEqual({ today: 1, inProgress: 1 });
  });
});

it("renders daily summary, filter chips, and grouped tasks", () => {
  const html = renderToStaticMarkup(
    createElement(Board, {
      tasks: [task("sin fecha", null)],
      partners: [{ uid: "a", displayName: "Ana" }],
      offline: false,
      busy: false,
      onCreate: vi.fn(),
      onEdit: vi.fn(),
      onStatusChange: vi.fn(),
    }),
  );
  expect(html).toContain("Sin fecha</h3>");
  expect(html).toContain("Limpiar filtros");
  expect(html).toContain("En progreso");
});
