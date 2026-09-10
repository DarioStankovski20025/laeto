"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { folderSchema, setProductFolderSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/utils/result";
import { handleDataError } from "@/lib/utils/pg-error";
import * as foldersData from "@/lib/data/folders";
import * as productsData from "@/lib/data/products";
import type { Folder } from "@/lib/data/folders";

function parseFolderForm(formData: FormData) {
  return folderSchema.safeParse({ name: formData.get("name") });
}

export async function createFolderAction(_prev: unknown, formData: FormData): Promise<ActionResult<Folder>> {
  await requireUser();
  const parsed = parseFolderForm(formData);
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  try {
    const folder = await foldersData.insertFolder(supabase, parsed.data);
    revalidatePath("/dashboard");
    return ok(folder);
  } catch (error) {
    return handleDataError(error);
  }
}

export async function renameFolderAction(
  folderId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<Folder>> {
  await requireUser();
  const parsed = parseFolderForm(formData);
  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  try {
    const folder = await foldersData.renameFolder(supabase, folderId, parsed.data);
    revalidatePath("/dashboard");
    return ok(folder);
  } catch (error) {
    return handleDataError(error);
  }
}

/** The folder's products are returned to the root by the FK's ON DELETE SET NULL. */
export async function deleteFolderAction(folderId: string): Promise<ActionResult<null>> {
  await requireUser();
  const supabase = await createServerSupabase();
  try {
    await foldersData.deleteFolder(supabase, folderId);
    revalidatePath("/dashboard");
    return ok(null);
  } catch (error) {
    return handleDataError(error);
  }
}

/** Moves one product into a folder, or out of every folder when folderId is null. */
export async function setProductFolderAction(
  productId: string,
  folderId: string | null,
): Promise<ActionResult<null>> {
  await requireUser();
  const parsed = setProductFolderSchema.safeParse({ folderId });
  if (!parsed.success) return fail("validation", "That folder is not valid.");

  const supabase = await createServerSupabase();
  try {
    await productsData.setProductFolder(supabase, productId, parsed.data.folderId);
    revalidatePath("/dashboard");
    return ok(null);
  } catch (error) {
    return handleDataError(error);
  }
}
