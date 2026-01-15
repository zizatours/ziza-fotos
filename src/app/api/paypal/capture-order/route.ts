import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const base = process.env.PAYPAL_BASE_URL!;

  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error("Failed to get PayPal access token");
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: Request) {
  const { orderID, event_slug, images, email, total, currency = "BRL" } =
    await req.json();

  if (!orderID || !email || !Array.isArray(images)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const base = process.env.PAYPAL_BASE_URL!;
  const accessToken = await getAccessToken();

  const captureRes = await fetch(`${base}/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const capture = await captureRes.json();

  if (!captureRes.ok) {
    return NextResponse.json({ error: capture }, { status: 400 });
  }

  // Captura ID (si existe)
  const paypalCaptureId =
    capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;

  // Guardar orden en Supabase
  const { data: saved, error: saveError } = await supabase
    .from("orders")
    .insert({
      event_slug: event_slug ?? null,
      email,
      selected_images: images,
      total_amount: Math.round(Number(total) * 100),
      currency,
      paypal_order_id: orderID,
      paypal_capture_id: paypalCaptureId,
      status: "paid",
    })
    .select("id")
    .single();

  if (saveError) {
    return NextResponse.json(
      { error: "db_insert_failed", detail: saveError.message, capture },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, order_id: saved.id });
}
