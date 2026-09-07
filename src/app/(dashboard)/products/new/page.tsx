import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { ProductForm } from "@/components/products/product-form";

export const metadata: Metadata = { title: "Add product — LAETO LTD" };

export default async function NewProductPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Add product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track a new Amazon product owned by LAETO LTD.</p>
      </div>
      <ProductForm mode="create" userId={user.id} />
    </div>
  );
}
