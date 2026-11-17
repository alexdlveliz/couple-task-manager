import { describe, expect, it } from "vitest";
import { deadlineTransition } from "../../src/worker/deadline-cycle";

describe("deadline cycles", () => {
  it.each([
    [null, "2029-01-01", "new"],
    ["2029-01-01", "2030-01-01", "new"],
    ["2030-01-01", "2029-01-01", "new"],
    ["2029-01-01", null, "remove"],
    ["2029-01-01", "2029-01-01", "preserve"],
    [null, null, "preserve"],
  ] as const)(
    "transitions %s to %s as %s",
    (oldDeadline, newDeadline, expected) => {
      expect(deadlineTransition(oldDeadline, newDeadline)).toBe(expected);
    },
  );
});
