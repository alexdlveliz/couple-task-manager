import {
  notificationConfig,
  saveSubscription,
  subscriptionStatus,
  removeSubscription,
} from "./notification-subscriptions";
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
async function jsonBody(request: Request, limit?: number): Promise<unknown> {
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
    if (limit !== undefined) {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limit) {
            await reader.cancel();
            throw new ApiFailure(
              413,
              "BODY_TOO_LARGE",
              "Los datos son demasiado grandes.",
            );
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    }
    return await request.json();
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
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
        const subscriptionMatch =
          /^\/api\/notifications\/subscriptions\/([^/]+)$/.exec(path);
        const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(path);
        const allow =
          path === "/api/notifications/config"
            ? "GET"
            : path === "/api/notifications/subscriptions"
              ? "POST"
              : subscriptionMatch
                ? "GET, DELETE"
                : path === "/api/partners"
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
        if (path === "/api/notifications/config")
          return Response.json(await notificationConfig(env), {
            headers: noStore,
          });
        if (path === "/api/notifications/subscriptions") {
          const saved = await saveSubscription(
            env.DB,
            uid,
            await jsonBody(request, 8192),
          );
          return Response.json(
            { id: saved.id, active: saved.active },
            { status: saved.created ? 201 : 200, headers: noStore },
          );
        }
        if (subscriptionMatch) {
          const id = decodeURIComponent(subscriptionMatch[1]);
          if (request.method === "DELETE") {
            await removeSubscription(env.DB, uid, id);
            return new Response(null, { status: 204, headers: noStore });
          }
          return Response.json(await subscriptionStatus(env.DB, uid, id), {
            headers: noStore,
          });
        }
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
