import type { Partner } from "../shared/contracts";
import { ApiFailure } from "./errors";

export async function authorizePartner(
  db: D1Database,
  uid: string,
): Promise<void> {
  const result = await db
    .prepare(
      "SELECT COUNT(*) AS count, MAX(CASE WHEN uid = ? AND enabled = 1 THEN 1 ELSE 0 END) AS authorized FROM partners",
    )
    .bind(uid)
    .first<{ count: number; authorized: number }>();
  if (!result || result.count !== 2)
    throw new ApiFailure(
      503,
      "SERVICE_UNAVAILABLE",
      "El servicio no está disponible. Inténtalo de nuevo.",
    );
  if (!result.authorized)
    throw new ApiFailure(
      403,
      "PARTNER_FORBIDDEN",
      "Esta cuenta no tiene acceso al tablero.",
    );
}
export async function listPartners(db: D1Database): Promise<Partner[]> {
  const result = await db
    .prepare(
      "SELECT uid, display_name AS displayName FROM partners WHERE enabled = 1 ORDER BY slot",
    )
    .all<Partner>();
  return result.results;
}
