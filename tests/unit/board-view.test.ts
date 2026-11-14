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
    expect(html).toContain('aria-label="Filtrar por estado"');
    expect(html).toContain('aria-label="Filtrar por responsable"');
    expect(html).toContain('aria-label="Cambiar estado: Comprar pan"');
  });
});
