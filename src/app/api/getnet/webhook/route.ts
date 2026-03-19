import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { renderOrderEmail } from "@/lib/orderEmail";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PendingOrderRow = {
  order_id: string;
  event_slug: string;
  email: string;
  images: string[];
  total_cents: number;
  tip_cents: number;
  currency: string | null;
  status: string;
  app_order_id: string | null;
};

function normalizeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.length > 0);
}

// GETNET está llamando por GET con query params (confirmado en logs)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    console.log("[GETNET WEBHOOK][GET] params:", params);

    const orderId = (params.order_id || "").trim();
    const callbackStatus = (params.status || "").trim().toUpperCase();
    const paymentType = (params.payment_type || "").trim().toLowerCase();
    const paymentId = (params.payment_id || "").trim();
    const transactionId = (params.transaction_id || "").trim();

    const amountRaw = (params.amount || "").trim();
    const amountCentsReported = /^\d+$/.test(amountRaw) ? Number(amountRaw) : null;

    if (!orderId) {
      console.warn("[GETNET WEBHOOK][GET] missing order_id");
      return NextResponse.json({ ok: true, ignored: "missing_order_id" });
    }

    // 1) Buscar pre-orden
    const { data: pending, error: pendingError } = await supabase
      .from("getnet_pending_orders")
      .select("order_id,event_slug,email,images,total_cents,tip_cents,currency,status,app_order_id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (pendingError) {
      console.error("[GETNET WEBHOOK][GET] pending select error:", pendingError);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    if (!pending) {
      console.warn("[GETNET WEBHOOK][GET] order_id not found in pending table:", orderId);
      return NextResponse.json({ ok: true, warning: "order_not_found" });
    }

    const p = pending as unknown as PendingOrderRow;

    // 2) Guardar info del callback (aunque no sea APPROVED)
    const basePatch: Record<string, any> = {
      callback_status: callbackStatus || null,
      payment_type: paymentType || null,
      getnet_payment_id: paymentId || null,
      getnet_transaction_id: transactionId || null,
      amount_cents_reported: amountCentsReported,
      callback_payload: params,
      updated_at: new Date().toISOString(),
    };

    const isApproved =
      callbackStatus === "APPROVED" ||
      callbackStatus === "APROVADO";

    if (isApproved) {
      basePatch.status = "approved";
      basePatch.approved_at = new Date().toISOString();
    }

    // ⚠️ No marcar como failed cualquier otro estado.
    // Getnet está enviando callbacks intermedios (ej. QR generado / aguardando pagamento).

    const { error: callbackUpdateError } = await supabase
      .from("getnet_pending_orders")
      .update(basePatch)
      .eq("order_id", orderId);

    if (callbackUpdateError) {
      console.error("[GETNET WEBHOOK][GET] callback update error:", callbackUpdateError);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    // 3) Si no está aprobado, no creamos orden
    if (!isApproved) {
      return NextResponse.json({ ok: true, updated: true, status: callbackStatus || "UNKNOWN" });
    }

    // 4) Idempotencia básica: si ya creó orden real, no duplicar
    if (p.app_order_id) {
      console.log("[GETNET WEBHOOK][GET] already fulfilled:", {
        order_id: p.order_id,
        app_order_id: p.app_order_id,
      });
      return NextResponse.json({
        ok: true,
        idempotent: true,
        order_id: p.order_id,
        app_order_id: p.app_order_id,
      });
    }

    const selectedImages = normalizeImages(p.images);
    if (selectedImages.length === 0) {
      console.error("[GETNET WEBHOOK][GET] pending order has no images:", p.order_id);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    // 5) Crear orden real (mismo modelo que PayPal capture-order)
    const { data: saved, error: saveError } = await supabase
      .from("orders")
      .insert({
        event_slug: p.event_slug ?? null,
        email: p.email,
        selected_images: selectedImages,
        total_amount: p.total_cents,
        tip_amount: p.tip_cents ?? 0,
        currency: p.currency || "BRL",
        status: "paid",
      })
      .select("id")
      .single();

    if (saveError) {
      console.error("[GETNET WEBHOOK][GET] orders insert error:", saveError);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    // 6) Marcar pre-orden como procesada (idempotencia)
    const appOrderId = String(saved.id);

    const { error: finalizePendingError } = await supabase
      .from("getnet_pending_orders")
      .update({
        app_order_id: appOrderId,
        order_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    if (finalizePendingError) {
      console.error("[GETNET WEBHOOK][GET] finalize pending error:", finalizePendingError);
      // no rompemos: la orden real ya fue creada
    }

    // 7) Enviar email (si falla, no rompe)
    try {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const siteUrl = process.env.SITE_URL || "https://zizaphotography.com.br";
      const from = process.env.EMAIL_FROM || "Ziza Photography <fotos@zizaphotography.com.br>";

      await resend.emails.send({
        from,
        to: p.email,
        subject: "Pagamento confirmado — Suas fotos estão prontas",
        html: renderOrderEmail({ siteUrl, orderId: saved.id }),
      });
    } catch (e) {
      console.log("[GETNET WEBHOOK][GET] EMAIL SEND ERROR:", e);
    }

    console.log("[GETNET WEBHOOK][GET] order created from callback:", {
      getnet_order_id: orderId,
      app_order_id: saved.id,
      status: callbackStatus,
    });

    return NextResponse.json({
      ok: true,
      fulfilled: true,
      getnet_order_id: orderId,
      app_order_id: saved.id,
    });
  } catch (err) {
    console.error("[GETNET WEBHOOK][GET] error:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// Mantén POST por compatibilidad (por si Getnet cambia el método)
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    let parsedBody: unknown = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = null;
    }

    const headersObj = Object.fromEntries(req.headers.entries());

    console.log("[GETNET WEBHOOK][POST] headers:", headersObj);
    console.log("[GETNET WEBHOOK][POST] rawBody:", rawBody);
    console.log("[GETNET WEBHOOK][POST] parsedBody:", parsedBody);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[GETNET WEBHOOK][POST] error:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}