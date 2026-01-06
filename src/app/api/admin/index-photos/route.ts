import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  IndexFacesCommand,
} from '@aws-sdk/client-rekognition'
import { createClient } from '@supabase/supabase-js'

const rekognition = new RekognitionClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { event_slug } = await req.json()

    if (!event_slug) {
      return NextResponse.json(
        { error: 'Missing event_slug' },
        { status: 400 }
      )
    }

    // 1️⃣ Listar fotos del evento desde Storage
    const { data: files, error: listError } = await supabase.storage
      .from('event-photos')
      .list(event_slug)

    if (listError) {
      console.error('STORAGE LIST ERROR:', listError)
      return NextResponse.json(
        { error: 'Failed to list photos' },
        { status: 500 }
      )
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No photos found for event' },
        { status: 400 }
      )
    }

    let indexed = 0

    // 2️⃣ Indexar cada foto con Rekognition
    for (const file of files) {
      if (!file.name) continue

      const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/event-photos/${event_slug}/${file.name}`

      // 🔍 Verificar si esta imagen ya fue indexada
      const { data: existing } = await supabase
        .from('event_faces')
        .select('id')
        .eq('event_slug', event_slug)
        .eq('image_url', imageUrl)
        .limit(1)

      if (existing && existing.length > 0) {
        continue // ya indexada, saltamos
      }

      // Descargar imagen desde Supabase
      const response = await fetch(imageUrl)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const command = new IndexFacesCommand({
        CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
        Image: {
          Bytes: buffer,
        },
      })

      const result = await rekognition.send(command)

      if (!result.FaceRecords || result.FaceRecords.length === 0) continue

      for (const record of result.FaceRecords) {
        if (!record.Face?.FaceId || !record.Face.BoundingBox) continue

        const { error: insertError } = await supabase
          .from('event_faces')
          .insert({
            event_slug,
            image_url: imageUrl,
            face_id: record.Face.FaceId,
            bounding_box: JSON.stringify(record.Face.BoundingBox),
          })

        if (insertError) {
          console.error('SUPABASE INSERT ERROR:', insertError)
          return NextResponse.json(
            { error: 'Failed to insert face data' },
            { status: 500 }
          )
        }

        indexed++
      }
    }

    return NextResponse.json({
      success: true,
      indexed,
    })
  } catch (err) {
    console.error('INDEX PHOTOS ERROR:', err)
    return NextResponse.json(
      { error: 'Indexing failed' },
      { status: 500 }
    )
  }
}
