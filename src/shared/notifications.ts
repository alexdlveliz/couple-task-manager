export interface NotificationPayload {
  version: 1;
  eventId: string;
  title: string;
  body: string;
  url: "/";
}

export interface NotificationRegistration {
  id: string;
  partnerUid: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  active: boolean;
}

export type DeliveryState = "pending" | "leased" | "accepted" | "abandoned";
export type DeliveryOutcome =
  | "accepted"
  | "invalid_registration"
  | "rate_limited"
  | "temporary_failure"
  | "permanent_failure";

export type DeliveryTransition =
  | "claim"
  | "accepted"
  | "retry"
  | "invalid_registration"
  | "lease_expired";

export function nextDeliveryState(
  state: DeliveryState,
  transition: DeliveryTransition,
): DeliveryState {
  if (state === "pending" && transition === "claim") return "leased";
  if (state === "leased") {
    if (transition === "accepted") return "accepted";
    if (transition === "retry" || transition === "lease_expired") return "pending";
    if (transition === "invalid_registration") return "abandoned";
  }
  throw new Error("Invalid notification delivery transition");
}
