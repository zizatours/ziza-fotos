import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderId = (url.searchParams.get("order_id") || "").trim();

    if (!orderId) {
      return NextResponse.json({ error: "missing_order_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("getnet_pending_orders")
      .select("order_id,status,callback_status,app_order_id,updated_at")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[GETNET RESOLVE ORDER] select error:", error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ found: false, status: "not_found" });
    }

    return NextResponse.json({
      found: true,
      getnet_order_id: data.order_id,
      status: data.status || null,
      callback_status: data.callback_status || null,
      app_order_id: data.app_order_id || null,
      updated_at: data.updated_at || null,
    });
  } catch (err) {
    console.error("[GETNET RESOLVE ORDER] error:", err);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}