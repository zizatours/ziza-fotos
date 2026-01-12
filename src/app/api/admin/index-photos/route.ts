import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  IndexFacesCommand,
} from '@aws-sdk/client-rekognition'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

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

    // 2️⃣ Indexar cada foto con Rekognition
    const candidates = (files ?? [])
      .filter((f) => !!f?.name)
      // si metadata viene, evitamos archivos vacíos
      .filter((f: any) => (f?.metadata?.size ?? 1) > 0)
      // solo imágenes comunes
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name))

    let indexed = 0
    let skipped = 0
    let failed = 0
    const failedFiles: string[] = []

    for (const file of candidates) {
      const objectPath = `${event_slug}/${file.name}`

      try {
        const { data: blob, error: downloadError } = await supabase.storage
          .from('event-photos')
          .download(objectPath)

        if (downloadError || !blob) {
          console.error('DOWNLOAD ERROR:', objectPath, downloadError)
          skipped++
          continue
        }

        const buffer = Buffer.from(await blob.arrayBuffer())

        if (buffer.length === 0) {
          console.error('EMPTY FILE (0 bytes):', objectPath)
          skipped++
          continue
        }

        const command = new IndexFacesCommand({
          CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
          Image: { Bytes: buffer },
          // opcional: limita cantidad de caras por foto
          MaxFaces: 10,
          QualityFilter: 'AUTO',
        })

        const result = await rekognition.send(command)

        const faceRecords =
          result.FaceRecords?.map((r) => ({
            event_slug,
            face_id: r.Face?.FaceId,
            image_path: objectPath,
          })) ?? []

        if (faceRecords.length === 0) {
          skipped++
          continue
        }

        const { error: dbError } = await supabase
          .from('event_faces')
          .insert(faceRecords)

        if (dbError) {
          console.error('DB INSERT ERROR:', objectPath, dbError)
          failed++
          failedFiles.push(objectPath)
          continue
        }

        indexed += faceRecords.length
      } catch (e) {
        console.error('INDEX ERROR:', objectPath, e)
        failed++
        failedFiles.push(objectPath)
        continue
      }
    }


    return NextResponse.json({
      success: true,
      indexed,
      skipped,
      failed,
      failedFiles,
    })
  } catch (err) {
    console.error('INDEX PHOTOS ERROR:', err)
    return NextResponse.json(
      { error: 'Indexing failed' },
      { status: 500 }
    )
  }
}
