import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RekognitionClient, DeleteFacesCommand } from "@aws-sdk/client-rekognition";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function isCronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  // Vercel suele enviar el secret en Authorization. Aceptamos ambos formatos.
  return auth === `Bearer ${secret}` || auth === secret;
}

// Borra “carpeta” en Supabase Storage listando y removiendo en batches.
// Soporta subcarpetas (recursivo).
async function removeFolder(bucket: string, prefix: string) {
  const toDelete: string[] = [];

  async function walk(path: string) {
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path, { limit, offset });

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const entry of data) {
        // Heurística: si no tiene metadata, suele ser “carpeta”
        const isFolder = !entry.metadata;
        if (isFolder) {
          await walk(`${path}/${entry.name}`);
        } else {
          toDelete.push(`${path}/${entry.name}`);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  await walk(prefix);

  // Remove en batches (para no mandar una lista gigante)
  const batchSize = 100;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw error;
  }

  return toDelete.length;
}

async function deleteFacesFromCollection(faceIds: string[]) {
  // Rekognition permite batch, usamos 1000 por seguridad
  const batchSize = 1000;
  let deleted = 0;

  for (let i = 0; i < faceIds.length; i += batchSize) {
    const batch = faceIds.slice(i, i + batchSize);
    if (batch.length === 0) continue;

    const cmd = new DeleteFacesCommand({
      CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
      FaceIds: batch,
    });

    try {
      const res = await rekognition.send(cmd);
      deleted += res.DeletedFaces?.length ?? 0;
    } catch {
      // Si falla Rekognition, igual continuamos con DB/Storage
    }
  }

  return deleted;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Traemos expirados (de a pocos por ejecución)
  const { data: events, error } = await supabase
    .from("events")
    .select("id, slug, expires_at")
    .lte("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let deletedEvents = 0;
  let deletedFiles = 0;
  let deletedFaceRows = 0;
  let deletedIndexedRows = 0;
  let deletedRekognitionFaces = 0;

  for (const ev of events ?? []) {
    const slug = ev.slug as string;

    // 1) borrar caras de Rekognition (opcional pero recomendado)
    const { data: faceRows } = await supabase
      .from("event_faces")
      .select("face_id")
      .eq("event_slug", slug);

    const faceIds =
      (faceRows ?? [])
        .map((r: any) => r.face_id)
        .filter((x: any) => typeof x === "string" && x.length > 0);

    if (faceIds.length > 0) {
      deletedRekognitionFaces += await deleteFacesFromCollection(faceIds);
    }

    // 2) borrar Storage: bucket "event-photos", carpeta "<slug>/"
    // (ajusta el bucket si tu nombre es distinto)
    try {
      deletedFiles += await removeFolder("event-photos", slug);
    } catch {
      // si falla storage, seguimos igual para no bloquear el cron
    }

    // 3) borrar tablas relacionadas
    const { count: c1 } = await supabase
      .from("event_faces")
      .delete({ count: "exact" })
      .eq("event_slug", slug);

    deletedFaceRows += c1 ?? 0;

    const { count: c2 } = await supabase
      .from("event_indexed_files")
      .delete({ count: "exact" })
      .eq("event_slug", slug);

    deletedIndexedRows += c2 ?? 0;

    // 4) borrar el evento
    await supabase.from("events").delete().eq("id", ev.id);

    deletedEvents += 1;
  }

  return NextResponse.json({
    ok: true,
    now: nowIso,
    scanned: events?.length ?? 0,
    deletedEvents,
    deletedFiles,
    deletedFaceRows,
    deletedIndexedRows,
    deletedRekognitionFaces,
  });
}
