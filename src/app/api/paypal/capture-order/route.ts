import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
  const { orderID } = await req.json();
  const base = process.env.PAYPAL_BASE_URL!;
  const accessToken = await getAccessToken();

  // Orders v2 - Capture order :contentReference[oaicite:6]{index=6}
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

  // Aquí (después) tú guardarías en Supabase: status=paid, orderID, captureID, etc.
  return NextResponse.json({ ok: true, capture });
}
