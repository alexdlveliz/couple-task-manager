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
