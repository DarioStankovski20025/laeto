"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { competitorSchema, MAX_COMPETITORS_PER_PRODUCT } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/utils/result";
import { handleDataError } from "@/lib/utils/pg-error";
import * as competitorsData from "@/lib/data/competitors";
import type { Competitor } from "@/lib/data/competitors";

function parseCompetitorForm(formData: FormData) {
  return competitorSchema.safeParse({
    asin: formData.get("asin"),
    title: formData.get("title"),
    amazonUrl: formData.get("amazonUrl"),
  });
}

export async function createCompetitorAction(
  productId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<Competitor>> {
  const user = await requireUser();
  const parsed = parseCompetitorForm(formData);
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();

  const currentCount = await competitorsData.countCompetitors(supabase, productId);
  if (currentCount >= MAX_COMPETITORS_PER_PRODUCT) {
    return fail("validation", `A product can track at most ${MAX_COMPETITORS_PER_PRODUCT} competitors.`);
  }

  try {
    const competitor = await competitorsData.insertCompetitor(supabase, user.id, productId, parsed.data);
    revalidatePath(`/products/${productId}/competitors`);
    revalidatePath("/dashboard");
    return ok(competitor);
  } catch (error) {
    return handleDataError(error);
  }
}

export async function updateCompetitorAction(
  productId: string,
  competitorId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<Competitor>> {
  const user = await requireUser();
  const parsed = parseCompetitorForm(formData);
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  try {
    const competitor = await competitorsData.updateCompetitor(supabase, user.id, competitorId, parsed.data);
    revalidatePath(`/products/${productId}/competitors`);
    return ok(competitor);
  } catch (error) {
    return handleDataError(error);
  }
}

export async function deleteCompetitorAction(productId: string, competitorId: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  try {
    await competitorsData.deleteCompetitor(supabase, user.id, competitorId);
    revalidatePath(`/products/${productId}/competitors`);
    revalidatePath("/dashboard");
    return ok(null);
  } catch (error) {
    return handleDataError(error);
  }
}
