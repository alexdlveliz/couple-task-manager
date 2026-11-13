import { describe, expect, it } from "vitest";
import { convertDeadline, displayDeadline } from "../../src/client/deadline";

describe("deadline conversion", () => {
  it("converts Guatemala to UTC and displays the same instant in Madrid", () => {
    expect(
      convertDeadline("2026-11-02", "09:00", "America/Guatemala").instant,
    ).toBe("2026-11-02T15:00:00Z");
    expect(displayDeadline("2026-11-02T15:00:00Z", "Europe/Madrid")).toContain(
      "16:00",
    );
  });
  it("rejects gaps and chooses the earlier fold with its offset", () => {
    expect(() =>
      convertDeadline("2027-03-14", "02:30", "America/New_York"),
    ).toThrow("Esta hora no existe");
    expect(convertDeadline("2027-11-07", "01:30", "America/New_York")).toEqual({
      instant: "2027-11-07T05:30:00Z",
      offset: "-04:00",
      ambiguous: true,
    });
  });
});

it("uses deadline-specific offsets and converts past instants without changing them", async () => {
  const { deadlineFields } = await import("../../src/client/deadline");
  const instant = "2020-07-15T15:30:00Z";
  expect(deadlineFields(instant, "America/New_York")).toEqual({
    date: "2020-07-15",
    time: "11:30",
    offset: "-04:00",
  });
  expect(
    convertDeadline("2020-07-15", "11:30", "America/New_York").instant,
  ).toBe(instant);
  expect(
    deadlineFields("2020-12-15T15:30:00Z", "America/New_York").offset,
  ).toBe("-05:00");
});
it("rejects impossible calendar fields", () => {
  expect(() =>
    convertDeadline("2027-02-30", "09:00", "America/Guatemala"),
  ).toThrow();
});

it("accepts absent and null deadlines, past instants, and rejects unzoned timestamps", async () => {
  const { parseCreateTask } = await import("../../src/shared/validation");
  expect(
    parseCreateTask({ title: "Tarea", assigneeUid: "a" }).deadline,
  ).toBeNull();
  expect(
    parseCreateTask({ title: "Tarea", assigneeUid: "a", deadline: null })
      .deadline,
  ).toBeNull();
  expect(
    parseCreateTask({
      title: "Tarea",
      assigneeUid: "a",
      deadline: "2000-01-01T12:00:00Z",
    }).deadline,
  ).toBe("2000-01-01T12:00:00Z");
  expect(() =>
    parseCreateTask({
      title: "Tarea",
      assigneeUid: "a",
      deadline: "2027-01-01T12:00:00",
    }),
  ).toThrow();
});
