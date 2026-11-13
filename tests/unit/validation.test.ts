import { describe, expect, it } from "vitest";
import { parseCreateTask, parseReplaceTask } from "../../src/shared/validation";

describe("task request validation", () => {
  it("trims titles and defaults an omitted deadline to null", () => {
    expect(
      parseCreateTask({ title: "  Hacer compras  ", assigneeUid: "partner-a" }),
    ).toEqual({
      title: "Hacer compras",
      assigneeUid: "partner-a",
      deadline: null,
    });
  });
  it.each([
    { title: " \n ", assigneeUid: "a" },
    { title: "x" },
    { title: "x", assigneeUid: "a", status: "completed" },
    { title: "x", assigneeUid: "a", id: "fake" },
    { title: "x", assigneeUid: "a", deadline: "2027-02-30T12:00:00Z" },
    { title: "x", assigneeUid: "a", deadline: "2027-01-01T12:00:00" },
  ])("rejects invalid create input %#", (input) => {
    expect(() => parseCreateTask(input)).toThrow();
  });
  it.each(["todo", "in_progress", "blocked", "completed"])(
    "accepts editable status %s",
    (status) => {
      expect(
        parseReplaceTask({
          title: "x",
          assigneeUid: "a",
          status,
          deadline: null,
        }).status,
      ).toBe(status);
    },
  );
  it("requires all editable PUT fields and rejects extras", () => {
    expect(() =>
      parseReplaceTask({ title: "x", assigneeUid: "a", status: "todo" }),
    ).toThrow();
    expect(() =>
      parseReplaceTask({
        title: "x",
        assigneeUid: "a",
        status: "todo",
        deadline: null,
        createdAt: "x",
      }),
    ).toThrow();
  });
  it("canonicalizes valid zoned instants and accepts past dates", () => {
    expect(
      parseCreateTask({
        title: "x",
        assigneeUid: "a",
        deadline: "2026-11-02T09:00:00-06:00",
      }).deadline,
    ).toBe("2026-11-02T15:00:00Z");
  });
});

it("maps required-field errors to Spanish and accepts all whitespace rules consistently", () => {
  try {
    parseCreateTask({ title: "\u00a0\t", assigneeUid: "" });
    throw new Error("Expected validation failure");
  } catch (error) {
    expect(error).toMatchObject({
      fields: {
        title: "Escribe un título.",
        assigneeUid: "Selecciona una persona autorizada.",
      },
    });
  }
  expect(
    parseCreateTask({ title: "\u00a0limpio\u00a0", assigneeUid: "a" }).title,
  ).toBe("limpio");
});
it("rejects unsupported statuses and server-generated fields on replacement", () => {
  expect(() =>
    parseReplaceTask({
      title: "x",
      assigneeUid: "a",
      status: "archived",
      deadline: null,
    }),
  ).toThrow();
  expect(() =>
    parseReplaceTask({
      title: "x",
      assigneeUid: "a",
      status: "todo",
      deadline: null,
      updatedAt: "2026-01-01T00:00:00Z",
    }),
  ).toThrow();
});
