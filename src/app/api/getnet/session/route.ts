import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getGetnetAccessToken() {
  const clientId = process.env.GETNET_CLIENT_ID!;
  const secret = process.env.GETNET_CLIENT_SECRET!;
  const base =
    process.env.GETNET_API_BASE ||
    (process.env.NODE_ENV === "production"
      ? "https://api.getnet.com.br"
      : "https://api-homologacao.getnet.com.br");

  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${base}/auth/oauth/v2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // En docs/ejemplos aparece scope=oob + client_credentials
    body: "scope=oob&grant_type=client_credentials",
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.access_token) {
    return { ok: false as const, status: res.status, data };
  }

  // ✅ La doc exige "Bearer <token>"
  const tokenType = (data.token_type || 'Bearer') as string
  return { ok: true as const, token: `${tokenType} ${data.access_token}` };
}

function money2(totalCents: number) {
  return (totalCents / 100).toFixed(2);
}

function isInvalidCheckoutImage(value: unknown) {
  if (typeof value !== "string") return true;
  const v = value.trim().toLowerCase();
  if (!v) return true;

  return (
    v.includes("/event-previews/") ||
    v.includes("/thumb/") ||
    v.includes("/cover/") ||
    v.endsWith(".webp")
  );
}

export async function POST(req: Request) {
  const { images, tip, event_slug, email } = await req.json();

  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "missing_images" }, { status: 400 });
  }

  if (typeof event_slug !== "string" || !event_slug.trim()) {
    return NextResponse.json({ error: "missing_event_slug" }, { status: 400 });
  }

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  if (images.some(isInvalidCheckoutImage)) {
    return NextResponse.json({ error: "invalid_images_preview_not_allowed" }, { status: 400 });
  }

  const quantity = images.length;
  const unitPriceCents = 1 * 100; // igual que PayPal

  const tipRaw = tip ?? 0;
  const tipNumber =
    typeof tipRaw === "string" ? Number(tipRaw.replace(",", ".")) : Number(tipRaw);

  const tipCents = Number.isFinite(tipNumber) && tipNumber > 0 ? Math.round(tipNumber * 100) : 0;

  if (tipCents > 500 * 100) {
    return NextResponse.json({ error: "tip_too_large" }, { status: 400 });
  }

  const subtotalCents = quantity * unitPriceCents;
  const totalCents = subtotalCents + tipCents;

  const tok = await getGetnetAccessToken();
  if (!tok.ok) {
    return NextResponse.json(
      {
        error: "getnet_token_failed",
        detail: tok.data,
        debug: {
          api_base: process.env.GETNET_API_BASE || "https://api-sandbox.getnet.com.br",
          has_client_id: !!process.env.GETNET_CLIENT_ID,
          has_client_secret: !!process.env.GETNET_CLIENT_SECRET,
        },
      },
      { status: 400 }
    );
  }

  // IDs locales para amarrar la sesión del checkout
  const order_id = crypto.randomUUID();
  const customer_id = crypto.randomUUID();

  const pendingInsert = await supabase.from("getnet_pending_orders").insert({
    order_id,
    customer_id,
    event_slug: event_slug.trim(),
    email: email.trim().toLowerCase(),
    images,
    quantity,
    unit_price_cents: unitPriceCents,
    tip_cents: tipCents,
    total_cents: totalCents,
    status: "pending",
  });

  if (pendingInsert.error) {
    console.error("[GETNET SESSION] pending order insert error:", pendingInsert.error);
    return NextResponse.json(
      { error: "getnet_pending_order_insert_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    access_token: tok.token,
    order_id,
    customer_id,
    amount: money2(totalCents),
    currency: "BRL",
  });
}
