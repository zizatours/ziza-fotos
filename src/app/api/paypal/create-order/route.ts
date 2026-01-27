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
  const { images, tip, currency = "BRL" } = await req.json();

  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "missing_images" }, { status: 400 });
  }

  const quantity = images.length;
  const unitPriceCents = 10 * 100; // R$ 10 por foto

  const tipRaw = tip ?? 0;
  const tipNumber =
    typeof tipRaw === "string" ? Number(tipRaw.replace(",", ".")) : Number(tipRaw);

  const tipCents = Number.isFinite(tipNumber) && tipNumber > 0 ? Math.round(tipNumber * 100) : 0;

  // tope opcional anti-troll: max R$500 de propina
  if (tipCents > 500 * 100) {
    return NextResponse.json({ error: "tip_too_large" }, { status: 400 });
  }

  const subtotalCents = quantity * unitPriceCents;
  const totalCents = subtotalCents + tipCents;
  const totalValue = (totalCents / 100).toFixed(2); // PayPal quiere string con 2 decimales

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
            value: totalValue,
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
