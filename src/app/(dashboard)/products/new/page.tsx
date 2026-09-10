import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import * as foldersData from "@/lib/data/folders";
import { ProductForm } from "@/components/products/product-form";

export const metadata: Metadata = { title: "Add product — LAETO LTD" };
export const dynamic = "force-dynamic";

export default async function NewProductPage(props: PageProps<"/products/new">) {
  await requireUser();
  const supabase = await createServerSupabase();
  const folders = await foldersData.listFolders(supabase);

  // "Add product to this folder" from inside a folder preselects it.
  const { folder } = await props.searchParams;
  const defaultFolderId = typeof folder === "string" && folder ? folder : null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Add product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track a new Amazon product owned by LAETO LTD.</p>
      </div>
      <ProductForm mode="create" folders={folders} defaultFolderId={defaultFolderId} />
    </div>
  );
}
