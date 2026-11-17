import { expect, it } from "vitest";
import { nextDeliveryState } from "../../src/shared/notifications";

it("permits delivery claims, outcomes, and recovery from expired leases", () => {
  expect(nextDeliveryState("pending", "claim")).toBe("leased");
  expect(nextDeliveryState("leased", "accepted")).toBe("accepted");
  expect(nextDeliveryState("leased", "retry")).toBe("pending");
  expect(nextDeliveryState("leased", "invalid_registration")).toBe("abandoned");
  expect(nextDeliveryState("leased", "lease_expired")).toBe("pending");
  expect(() => nextDeliveryState("accepted", "claim")).toThrow();
  expect(() => nextDeliveryState("pending", "accepted")).toThrow();
});
