import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const placeId = process.env.GOOGLE_PLACE_ID!;

  if (!apiKey || !placeId) {
    return NextResponse.json({ error: "missing_env" }, { status: 400 });
  }

  // Places API (New)
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=displayName,rating,userRatingCount,reviews`;

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      // Field mask requerido en muchas cuentas
      "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews",
    },
    // cachea un rato para no gastar cuota a cada visita
    next: { revalidate: 60 * 60 * 12 }, // 12 horas
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: "google_error", data }, { status: 500 });
  }

  // Normalizamos lo mínimo para el frontend
  const reviews = (data.reviews || []).map((r: any) => ({
    author: r.authorAttribution?.displayName || "Cliente",
    rating: r.rating,
    text: r.text?.text || "",
    time: r.relativePublishTimeDescription || "",
  }));

  return NextResponse.json(
    {
      name: data.displayName?.text || "Ziza",
      rating: data.rating || null,
      total: data.userRatingCount || null,
      reviews,
    },
    {
      headers: {
        // 12 horas cache en CDN (Vercel)
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600",
      },
    }
  );
}
