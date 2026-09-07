/** Discriminated result type returned by every Server Action across the app. */
export type ActionErrorCode =
  | "validation"
  | "unauthenticated"
  | "unauthorized"
  | "conflict"
  | "not_found"
  | "scraper"
  | "storage"
  | "unknown";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, code, message, fieldErrors };
}
