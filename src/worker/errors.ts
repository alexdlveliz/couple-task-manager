import { InvalidTokenError, KeyServiceError } from "./auth";
import { ValidationError } from "../shared/validation";

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public headers?: HeadersInit,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown): Response {
  let failure: ApiFailure;
  if (error instanceof ApiFailure) failure = error;
  else if (error instanceof InvalidTokenError)
    failure = new ApiFailure(
      401,
      "INVALID_TOKEN",
      "Tu sesión ya no es válida. Inicia sesión de nuevo.",
    );
  else if (error instanceof ValidationError)
    failure = new ApiFailure(
      400,
      "VALIDATION_ERROR",
      error.message,
      error.fields,
    );
  else if (
    error instanceof KeyServiceError ||
    (error instanceof Error && /(?:D1_ERROR|SQLITE_)/.test(error.message))
  )
    failure = new ApiFailure(
      503,
      "SERVICE_UNAVAILABLE",
      "El servicio no está disponible. Inténtalo de nuevo.",
    );
  else
    failure = new ApiFailure(
      500,
      "INTERNAL_ERROR",
      "No se pudo completar la operación. Inténtalo de nuevo.",
    );
  const headers = new Headers(failure.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(
    {
      error: {
        code: failure.code,
        message: failure.message,
        ...(failure.fields && Object.keys(failure.fields).length
          ? { fields: failure.fields }
          : {}),
      },
    },
    { status: failure.status, headers },
  );
}
