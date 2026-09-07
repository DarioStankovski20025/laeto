"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { z } from "zod";
import { productSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/utils/result";
import { handleDataError } from "@/lib/utils/pg-error";
import * as productsData from "@/lib/data/products";
import { removeProductImages } from "@/lib/data/storage";
import type { Product } from "@/lib/data/products";

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    asin: formData.get("asin"),
    title: formData.get("title"),
    notifyEnabled: formData.get("notifyEnabled") === "true",
    imagePath: formData.get("imagePath") || null,
  });
}

export async function createProductAction(_prev: unknown, formData: FormData): Promise<ActionResult<Product>> {
  const user = await requireUser();
  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  // The image, if any, was uploaded browser-direct to Storage (Server Action
  // bodies are capped at 1MB by default — far too small for a product
  // photo). We only re-validate that the claimed path belongs to this user.
  if (parsed.data.imagePath && !parsed.data.imagePath.startsWith(`${user.id}/`)) {
    return fail("validation", "Invalid image path.");
  }

  const idField = formData.get("id");
  const idParsed = typeof idField === "string" ? z.uuid().safeParse(idField) : undefined;
  const explicitId = idParsed?.success ? idParsed.data : undefined;

  const supabase = await createServerSupabase();
  try {
    const product = await productsData.insertProduct(supabase, user.id, parsed.data, explicitId);
    revalidatePath("/dashboard");
    return ok(product);
  } catch (error) {
    // The image (if any) was already uploaded client-side before this action
    // ran. If the product row itself never gets created, that object has no
    // row to be cleaned up by the products_image_gc trigger, so remove it
    // here — best effort, never lets a storage error mask the real failure.
    if (parsed.data.imagePath) {
      await removeProductImages(supabase, [parsed.data.imagePath]).catch(() => {});
    }
    return handleDataError(error);
  }
}

export async function updateProductAction(
  productId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<Product>> {
  const user = await requireUser();
  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  try {
    const product = await productsData.updateProduct(supabase, user.id, productId, parsed.data);

    // Image replacement, if a new path was uploaded: swap atomically
    // (upload already happened client-side) then delete the old object.
    if (parsed.data.imagePath !== undefined) {
      if (parsed.data.imagePath && !parsed.data.imagePath.startsWith(`${user.id}/`)) {
        return fail("validation", "Invalid image path.");
      }
      const previousPath = await productsData.setProductImage(supabase, productId, parsed.data.imagePath);
      if (previousPath && previousPath !== parsed.data.imagePath) {
        await removeProductImages(supabase, [previousPath]);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/products/${productId}/edit`);
    return ok(product);
  } catch (error) {
    return handleDataError(error);
  }
}

export async function removeProductImageAction(productId: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  try {
    const product = await productsData.getProduct(supabase, user.id, productId);
    if (!product) return fail("not_found", "Product not found.");

    const previousPath = await productsData.setProductImage(supabase, productId, null);
    if (previousPath) await removeProductImages(supabase, [previousPath]);

    revalidatePath("/dashboard");
    revalidatePath(`/products/${productId}/edit`);
    return ok(null);
  } catch (error) {
    return handleDataError(error);
  }
}

export async function setProductNotifyAction(productId: string, notifyEnabled: boolean): Promise<ActionResult<Product>> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  try {
    const product = await productsData.setProductNotify(supabase, user.id, productId, notifyEnabled);
    revalidatePath("/dashboard");
    return ok(product);
  } catch (error) {
    return handleDataError(error);
  }
}

export async function deleteProductAction(productId: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  try {
    const deleted = await productsData.deleteProduct(supabase, user.id, productId);
    if (!deleted) return fail("not_found", "Product not found.");

    // The DB cascade removes competitors and report_runs rows; the storage
    // object is enqueued for cleanup by the products_image_gc trigger, but we
    // also attempt an immediate best-effort delete via the admin client so it
    // usually disappears from Storage right away rather than waiting for the
    // next GC sweep.
    if (deleted.image_path) {
      const admin = createAdminSupabase();
      await removeProductImages(admin, [deleted.image_path]);
    }

    revalidatePath("/dashboard");
    return ok(null);
  } catch (error) {
    return handleDataError(error);
  }
}
