import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import * as productsData from "@/lib/data/products";
import * as competitorsData from "@/lib/data/competitors";
import { CompetitorsPageClient } from "@/components/competitors/competitors-page-client";

export const metadata: Metadata = { title: "Competitors — LAETO LTD" };
export const dynamic = "force-dynamic";

export default async function ProductCompetitorsPage(props: PageProps<"/products/[id]/competitors">) {
  const { id } = await props.params;
  await requireUser();
  const supabase = await createServerSupabase();

  const product = await productsData.getProduct(supabase, id);
  if (!product) notFound();

  const competitors = await competitorsData.listCompetitors(supabase, id);

  return <CompetitorsPageClient product={product} competitors={competitors} />;
}
