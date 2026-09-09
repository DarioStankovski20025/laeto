import type { PostgrestError } from "@supabase/supabase-js";
import { fail, type ActionResult } from "@/lib/utils/result";

/**
 * Maps known Postgres/PostgREST error signatures to a friendly ActionResult.
 * Falls back to a generic message — raw DB errors must never reach the browser.
 */
export function mapPostgrestError<T = never>(error: PostgrestError): ActionResult<T> {
  const constraint = error.message;

  if (error.code === "23505") {
    if (constraint.includes("products_asin_key")) {
      return fail("conflict", "This ASIN is already tracked.");
    }
    if (constraint.includes("competitors_product_asin_key")) {
      return fail("conflict", "This competitor is already added to this product.");
    }
    if (constraint.includes("report_runs_one_daily_per_day")) {
      return fail("conflict", "A daily report has already run for today.");
    }
    if (constraint.includes("report_runs_one_active_manual_per_product")) {
      return fail("conflict", "A check is already running for this product.");
    }
    return fail("conflict", "This record already exists.");
  }

  if (error.code === "23514") {
    if (constraint.includes("competitor_limit") || error.hint?.includes("20 competitors")) {
      return fail("validation", "A product can track at most 20 competitors.");
    }
    if (constraint.includes("asin_format")) {
      return fail("validation", "ASIN must be exactly 10 uppercase letters or numbers.");
    }
    if (constraint.includes("url_https")) {
      return fail("validation", "The URL must be a valid HTTPS Amazon link.");
    }
    return fail("validation", "The provided data did not pass validation.");
  }

  if (error.code === "P0002") {
    return fail("not_found", "The requested record was not found.");
  }

  if (error.code === "42501") {
    return fail("unauthorized", "You do not have permission to perform this action.");
  }

  return fail("unknown", "A database error occurred. Please try again.");
}

function isPostgrestErrorLike(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "details" in error
  );
}

/** Safe catch-block handler: narrows to a PostgrestError when possible, else a generic failure. */
export function handleDataError<T = never>(error: unknown): ActionResult<T> {
  if (isPostgrestErrorLike(error)) return mapPostgrestError<T>(error);
  return fail("unknown", "Something went wrong. Please try again.");
}
