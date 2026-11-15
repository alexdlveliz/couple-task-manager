import { processOverdue } from "./notification-scheduler";
import { cleanupNotifications } from "./notification-maintenance";
import { verifyFirebaseToken } from "./auth";
import {
  dispatchDeliveries,
  type DeliveryTransport,
} from "./notification-delivery";
import { sendWebPush } from "./web-push";
import { ApiFailure, errorResponse } from "./errors";
import { authorizePartner, listPartners } from "./partners";
import {
  createTask,
  deleteTask,
  readBoard,
  readRevision,
  replaceTask,
} from "./tasks";
import { validateEnvironment, type Env } from "./env";
import { parseCreateTask, parseReplaceTask } from "../shared/validation";

const noStore = { "Cache-Control": "no-store" };
async function jsonBody(request: Request): Promise<unknown> {
  if (
    !/^application\/json(?:\s*;|\s*$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new ApiFailure(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Envía los datos en formato JSON.",
    );
  try {
    return await request.json();
  } catch {
    throw new ApiFailure(400, "INVALID_JSON", "Revisa los datos de la tarea.");
  }
}
export function createWorker(
  local = false,
  transportOverride?: DeliveryTransport,
) {
  return {
    async scheduled(
      controller: { scheduledTime: number },
      env: Env,
    ): Promise<void> {
      const now = new Date(controller.scheduledTime);
      await processOverdue(env.DB, now);
      if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) {
        const publicKey = env.VAPID_PUBLIC_KEY,
          privateKey = env.VAPID_PRIVATE_KEY,
          subject = env.VAPID_SUBJECT;
        const transport: DeliveryTransport =
          transportOverride ??
          ((delivery) =>
            sendWebPush({
              ...delivery,
              vapidPublicKey: publicKey,
              vapidPrivateKey: privateKey,
              subject,
            }));
        await dispatchDeliveries(env.DB, { now, transport });
      }
      await cleanupNotifications(env.DB, now);
    },
    async fetch(
      request: Request,
      env: Env,
      context?: { waitUntil(promise: Promise<unknown>): void },
    ): Promise<Response> {
      const dispatch = () => {
        if (
          !context ||
          !env.VAPID_PUBLIC_KEY ||
          !env.VAPID_PRIVATE_KEY ||
          !env.VAPID_SUBJECT
        )
          return;
        const publicKey = env.VAPID_PUBLIC_KEY,
          privateKey = env.VAPID_PRIVATE_KEY,
          subject = env.VAPID_SUBJECT;
        const transport: DeliveryTransport =
          transportOverride ??
          ((delivery) =>
            sendWebPush({
              ...delivery,
              vapidPublicKey: publicKey,
              vapidPrivateKey: privateKey,
              subject,
            }));
        try {
          context.waitUntil(
            dispatchDeliveries(env.DB, { now: new Date(), transport }).catch(
              () => {},
            ),
          );
        } catch {
          /* Saving must remain independent of delivery. */
        }
      };
      const url = new URL(request.url);
      if (url.pathname !== "/api" && !url.pathname.startsWith("/api/"))
        return env.ASSETS.fetch(request);
      try {
        try {
          validateEnvironment(env, local);
        } catch {
          throw new ApiFailure(
            503,
            "SERVICE_UNAVAILABLE",
            "El servicio no está disponible. Inténtalo de nuevo.",
          );
        }
        const match = /^Bearer\s+(\S+)$/i.exec(
          request.headers.get("Authorization") ?? "",
        );
        if (!match)
          throw new ApiFailure(
            401,
            "AUTH_REQUIRED",
            "Tu sesión ya no es válida. Inicia sesión de nuevo.",
          );
        const uid = await verifyFirebaseToken(match[1], env, local);
        await authorizePartner(env.DB, uid);
        const path = url.pathname;
        const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(path);
        const allow =
          path === "/api/partners"
            ? "GET"
            : path === "/api/tasks"
              ? "GET, POST"
              : taskMatch
                ? "PUT, DELETE"
                : null;
        if (!allow)
          throw new ApiFailure(
            404,
            "ROUTE_NOT_FOUND",
            "No se encontró la dirección solicitada.",
          );
        if (!allow.split(", ").includes(request.method))
          throw new ApiFailure(
            405,
            "METHOD_NOT_ALLOWED",
            "Método no permitido.",
            undefined,
            { Allow: allow },
          );
        if (path === "/api/partners")
          return Response.json(
            { partners: await listPartners(env.DB) },
            { headers: noStore },
          );
        if (path === "/api/tasks" && request.method === "GET") {
          const revision = await readRevision(env.DB);
          const tag = `"board-r${String(revision)}"`;
          if (request.headers.get("If-None-Match") === tag)
            return new Response(null, {
              status: 304,
              headers: { ...noStore, ETag: tag },
            });
          const board = await readBoard(env.DB);
          return Response.json(board, {
            headers: { ...noStore, ETag: `"board-r${String(board.revision)}"` },
          });
        }
        if (path === "/api/tasks") {
          const saved = await createTask(
            env.DB,
            uid,
            parseCreateTask(await jsonBody(request)),
          );
          dispatch();
          return Response.json(saved, { status: 201, headers: noStore });
        }
        if (!taskMatch)
          throw new ApiFailure(
            404,
            "ROUTE_NOT_FOUND",
            "No se encontró la dirección solicitada.",
          );
        if (request.method === "DELETE")
          return Response.json(
            await deleteTask(env.DB, uid, decodeURIComponent(taskMatch[1])),
            { headers: noStore },
          );
        const saved = await replaceTask(
          env.DB,
          uid,
          decodeURIComponent(taskMatch[1]),
          parseReplaceTask(await jsonBody(request)),
        );
        dispatch();
        return Response.json(saved, { headers: noStore });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
export default createWorker();
