import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  RekognitionClient,
  IndexFacesCommand,
} from '@aws-sdk/client-rekognition'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: Request) {
  // ===============================
  // E6 — leer event_slug
  // ===============================
  const { event_slug } = await req.json()

  if (!event_slug) {
    return NextResponse.json(
      { error: 'Missing event_slug' },
      { status: 400 }
    )
  }

  // ===============================
  // Listar SOLO fotos del evento
  // ===============================
  const { data: files, error: listError } = await supabase.storage
    .from('event-photos')
    .list(event_slug)

  if (listError) {
    console.error(listError)
    return NextResponse.json(
      { error: 'Failed to list event photos' },
      { status: 500 }
    )
  }

  let indexedPhotos = 0
  let skippedPhotos = 0

  for (const file of files ?? []) {
    if (!file.name) continue

    const path = `${event_slug}/${file.name}`

    const { data: publicUrlData } = supabase.storage
      .from('event-photos')
      .getPublicUrl(path)

    const imageUrl = publicUrlData.publicUrl

    // ===============================
    // E6 — VERIFICAR SI YA EXISTE
    // ===============================
    const { data: existing } = await supabase
      .from('event_faces')
      .select('id')
      .eq('event_slug', event_slug)
      .eq('image_url', imageUrl)
      .limit(1)

    if (existing && existing.length > 0) {
      skippedPhotos++
      continue
    }

    // ===============================
    // Indexar SOLO fotos nuevas
    // ===============================
    try {
      const command = new IndexFacesCommand({
        CollectionId: event_slug,
        Image: {
          S3Object: {
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
            Name: path,
          },
        },
        ExternalImageId: file.name,
        DetectionAttributes: [],
      })

      const result = await rekognition.send(command)

      for (const face of result.FaceRecords ?? []) {
        if (!face.Face?.FaceId || !face.Face?.BoundingBox) continue

        await supabase.from('event_faces').insert({
          event_slug,
          image_url: imageUrl,
          face_id: face.Face.FaceId,
          bounding_box: face.Face.BoundingBox,
        })
      }

      indexedPhotos++
    } catch (err) {
      console.error('Index error:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    indexedPhotos,
    skippedPhotos,
  })
}
