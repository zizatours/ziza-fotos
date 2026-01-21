import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

function toPublicUrl(pathOrUrl: string) {
  // Soporta:
  // - URL completa https://...
  // - path tipo "evento/archivo.jpg"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const bucket = "event-photos";

  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  if (!supabaseUrl) return pathOrUrl; // fallback
  const clean = pathOrUrl.replace(/^\/+/, "");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const path = searchParams.get("path");
    const src = searchParams.get("src");
    const w = Math.max(64, Math.min(1200, Number(searchParams.get("w") || 480)));
    const q = Math.max(30, Math.min(90, Number(searchParams.get("q") || 60)));

    const input = (src || path || "").trim();
    if (!input) {
      return NextResponse.json({ error: "missing_src_or_path" }, { status: 400 });
    }

    const url = toPublicUrl(input);

    const upstream = await fetch(url, {
      // Ojo: no siempre hace falta, pero ayuda a evitar caches raros
      headers: { "User-Agent": "thumb-bot" },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "upstream_failed", status: upstream.status },
        { status: 502 }
      );
    }

    const arr = await upstream.arrayBuffer();
    const inputBuf = Buffer.from(arr);

    // Auto orienta, resize, comprime a webp (rápido y liviano)
    const out = await sharp(inputBuf)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer();

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        // cache CDN: 1 día (ajustable)
        "Cache-Control": "public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "thumb_error" }, { status: 500 });
  }
}
