// src/app/api/paypal/webhook/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // importante en Vercel para crypto/fetch estable

export async function POST(req: Request) {
  // 1) Leer el body (PayPal manda JSON)
  const bodyText = await req.text();
  const event = JSON.parse(bodyText);

  // 2) (MUY recomendado) Verificar firma del webhook antes de confiar
  const ok = await verifyPayPalWebhookSignature(req, bodyText);
  if (!ok) {
    return NextResponse.json({ ok: false, reason: "invalid_signature" }, { status: 400 });
  }

  // 3) Procesar eventos relevantes
  // Tip: el evento trae event_type
  const eventType = event?.event_type;

  // EJEMPLOS típicos:
  // - PAYMENT.CAPTURE.COMPLETED => pago capturado (este suele ser el "pago real")
  // - CHECKOUT.ORDER.APPROVED => el cliente aprobó, pero aún podría faltar capturar en backend
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    // Aquí marcas la compra como pagada en tu DB (Supabase),
    // y habilitas descarga / entrega.
    // event.resource suele traer info de la captura.
  }

  if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
    // Aquí podrías marcar como reembolsado, etc.
  }

  // 4) Responder 200 rápido
  return NextResponse.json({ ok: true });
}

async function verifyPayPalWebhookSignature(req: Request, bodyText: string) {
  const paypalWebhookId = process.env.PAYPAL_WEBHOOK_ID;
  const paypalClientId = process.env.PAYPAL_CLIENT_ID;
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const paypalBase = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

  if (!paypalWebhookId || !paypalClientId || !paypalClientSecret) {
    // Si falta config, NO aceptes webhooks como válidos
    return false;
  }

  // Headers que PayPal envía (necesarios para verificar)
  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  // 1) Obtener access token (client_credentials)
  const basic = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString("base64");

  const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) return false;
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) return false;

  // 2) Llamar a verify-webhook-signature
  // (PayPal recomienda verificar los webhooks) :contentReference[oaicite:1]{index=1}
  const verifyRes = await fetch(`${paypalBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: paypalWebhookId,
      webhook_event: JSON.parse(bodyText),
    }),
  });

  if (!verifyRes.ok) return false;
  const verifyJson = await verifyRes.json();

  // PayPal retorna verification_status: "SUCCESS" cuando es válido :contentReference[oaicite:2]{index=2}
  return verifyJson.verification_status === "SUCCESS";
}
