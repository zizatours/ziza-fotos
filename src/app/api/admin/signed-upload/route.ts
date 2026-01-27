import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "event-photos";

export async function POST(req: Request) {
  const { event_slug, file_name, content_type } = await req.json();

  if (!event_slug || !file_name) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // OJO: aquí usamos la key REAL que quieres guardar
  const path = `${event_slug}/${file_name}`;

  // Crea signed URL para subir (subida directa desde el browser)
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json({ error: "signed_upload_error", details: error }, { status: 500 });
  }

  return NextResponse.json({
    path,
    signedUrl: data.signedUrl,
    token: data.token,
    contentType: content_type || "application/octet-stream",
  });
}
