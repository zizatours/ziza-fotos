import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const order = searchParams.get("order") || "";

  if (!order) {
    return NextResponse.json({ error: "missing_order" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, event_slug, email, images, total, currency, status")
    .eq("id", order)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ order: data });
}
