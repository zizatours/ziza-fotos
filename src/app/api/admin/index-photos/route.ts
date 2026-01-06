import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  DetectFacesCommand,
} from '@aws-sdk/client-rekognition'
import { createAdminClient } from '@/lib/supabase-server'

const supabase = createAdminClient()


const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// helper: descargar imagen desde Supabase (URL pública) y devolver bytes
async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  const arrayBuffer = await res.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

export async function POST(req: Request) {
  // ===============================
  // E5/E6 — leer event_slug
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
    // E6 — evitar reindexar
    // ===============================
    const { count } = await supabase
      .from('event_faces')
      .select('*', { count: 'exact', head: true })
      .eq('event_slug', event_slug)
      .eq('image_url', imageUrl)

    if ((count ?? 0) > 0) {
      skippedPhotos++
      continue
    }

    try {
      // ===============================
      // Descargar imagen y detectar caras
      // ===============================
      const imageBytes = await fetchImageBytes(imageUrl)

      const detectCommand = new DetectFacesCommand({
        Image: {
          Bytes: imageBytes,
        },
        Attributes: [],
      })

      const detectResult = await rekognition.send(detectCommand)

      if (!detectResult.FaceDetails || detectResult.FaceDetails.length === 0) {
        skippedPhotos++
        continue
      }

      // ===============================
      // Guardar cada cara detectada
      // ===============================
      for (const face of detectResult.FaceDetails) {
        if (!face.BoundingBox) continue

        const { error: insertError } = await supabase.from('event_faces').insert({
          event_slug,
          image_url: imageUrl,
          face_id: crypto.randomUUID(),
          // más seguro: guardamos como JSON string (evita fallas por tipo de columna)
          bounding_box: JSON.stringify(face.BoundingBox),
        })

        if (insertError) {
          console.error('SUPABASE INSERT ERROR:', insertError)
          return NextResponse.json(
            { error: 'Failed to insert into event_faces', details: insertError },
            { status: 500 }
          )
        }
      }

      indexedPhotos++
    } catch (err) {
      console.error('Detect error:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    indexedPhotos,
    skippedPhotos,
  })
}
