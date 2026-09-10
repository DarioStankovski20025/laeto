import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import * as productsData from "@/lib/data/products";
import * as foldersData from "@/lib/data/folders";
import { signOneProductImage } from "@/lib/data/storage";
import { ProductForm } from "@/components/products/product-form";

export const metadata: Metadata = { title: "Edit product — LAETO LTD" };
export const dynamic = "force-dynamic";

export default async function EditProductPage(props: PageProps<"/products/[id]/edit">) {
  const { id } = await props.params;
  await requireUser();
  const supabase = await createServerSupabase();

  const [product, folders] = await Promise.all([
    productsData.getProduct(supabase, id),
    foldersData.listFolders(supabase),
  ]);
  if (!product) notFound();

  const existingImageUrl = product.image_path ? await signOneProductImage(supabase, product.image_path) : null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Edit product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update {product.title}.</p>
      </div>
      <ProductForm mode="edit" product={product} existingImageUrl={existingImageUrl} folders={folders} />
    </div>
  );
}
