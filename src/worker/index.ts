import { verifyFirebaseToken } from "./auth";
import { ApiFailure, errorResponse } from "./errors";
import { authorizePartner, listPartners } from "./partners";
import { createTask, readBoard, readRevision, replaceTask } from "./tasks";
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
export function createWorker(local = false) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
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
                ? "PUT"
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
        if (path === "/api/tasks")
          return Response.json(
            await createTask(
              env.DB,
              uid,
              parseCreateTask(await jsonBody(request)),
            ),
            { status: 201, headers: noStore },
          );
        if (!taskMatch)
          throw new ApiFailure(
            404,
            "ROUTE_NOT_FOUND",
            "No se encontró la dirección solicitada.",
          );
        return Response.json(
          await replaceTask(
            env.DB,
            uid,
            decodeURIComponent(taskMatch[1]),
            parseReplaceTask(await jsonBody(request)),
          ),
          { headers: noStore },
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
export default createWorker();
