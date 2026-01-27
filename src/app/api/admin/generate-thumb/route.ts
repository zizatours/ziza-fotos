import { NextResponse } from "next/server";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SRC_BUCKET = "event-photos";
const DST_BUCKET = "event-previews";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { event_slug, src_path } = await req.json();

    if (!event_slug || !src_path) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // 1) Descargar original (con service role, no depende de bucket public)
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from(SRC_BUCKET)
      .download(src_path);

    if (dlErr || !file) {
      return NextResponse.json({ error: "download_failed", details: dlErr }, { status: 500 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // 2) Watermark local (MISMA lógica que tu /api/preview)
    const watermarkPath = path.join(process.cwd(), "public", "watermark.png");
    const watermarkBuffer = await readFile(watermarkPath);

    // 3) Generar thumb (ajusta tamaño si quieres)
    let img = sharp(inputBuffer).rotate();
    img = img.resize({ width: 520, withoutEnlargement: true });

    img = img.composite([{ input: watermarkBuffer, tile: true, blend: "over" }]);

    const output = await img.webp({ quality: 60 }).toBuffer();

    // 4) Guardar thumb en event-previews/<slug>/thumb/<nombre>.webp
    const base = src_path.split("/").pop() || "image.jpg";
    const baseNoExt = base.replace(/\.[^/.]+$/, "");
    const thumbPath = `${event_slug}/thumb/${baseNoExt}.webp`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(DST_BUCKET)
      .upload(thumbPath, output, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "31536000",
      });

    if (upErr) {
      return NextResponse.json({ error: "upload_thumb_failed", details: upErr }, { status: 500 });
    }

    return NextResponse.json({ ok: true, thumbPath });
  } catch (err) {
    console.log("GENERATE THUMB ERROR:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
