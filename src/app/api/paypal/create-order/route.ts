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
  const { total, currency = "BRL" } = await req.json();

  const base = process.env.PAYPAL_BASE_URL!;
  const accessToken = await getAccessToken();

  // Orders v2 - Create order :contentReference[oaicite:4]{index=4}
  const orderRes = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: String(total),
          },
        },
      ],
    }),
  });

  const order = await orderRes.json();
  if (!orderRes.ok) {
    return NextResponse.json({ error: order }, { status: 400 });
  }

  return NextResponse.json({ id: order.id });
}
