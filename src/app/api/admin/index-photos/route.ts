export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { RekognitionClient, IndexFacesCommand } from '@aws-sdk/client-rekognition'
import { createClient } from '@supabase/supabase-js'

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type StreamMsg =
  | { type: 'start'; total: number }
  | { type: 'file'; name: string }
  | { type: 'failed'; name: string; reason?: string }
  | { type: 'progress'; done: number; indexed: number; skipped: number; failed: number }
  | { type: 'done'; indexed: number; skipped: number; failed: number; failedFiles: string[] }

export async function POST(req: Request) {
  try {
    const { event_slug } = await req.json()

    if (!event_slug) {
      return NextResponse.json({ error: 'Missing event_slug' }, { status: 400 })
    }

    const encoder = new TextEncoder()
    const failedFiles: string[] = []

    // helper: escribir una línea NDJSON
    const write = (controller: ReadableStreamDefaultController, msg: StreamMsg) => {
      controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'))
    }

    // 1) listar TODO (paginado) desde storage/event-photos/<event_slug>/
    const allFiles: any[] = []
    let offset = 0
    const limit = 1000

    while (true) {
      const { data, error } = await supabase.storage
        .from('event-photos')
        .list(event_slug, { limit, offset })

      if (error) {
        console.error('STORAGE LIST ERROR:', error)
        return NextResponse.json({ error: 'Failed to list photos' }, { status: 500 })
      }

      const batch = data ?? []
      allFiles.push(...batch)

      if (batch.length < limit) break
      offset += limit
    }

    // candidatos: solo nombres válidos y extensiones imagen
    const candidates = allFiles
      .filter((f) => !!f?.name)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name))

    // 2) stream response
    let done = 0
    let indexed = 0
    let skipped = 0
    let failed = 0

    const stream = new ReadableStream({
      async start(controller) {
        write(controller, { type: 'start', total: candidates.length })

        for (const file of candidates) {
          const objectPath = `${event_slug}/${file.name}`
          write(controller, { type: 'file', name: objectPath })

          try {
            const { data: blob, error: downloadError } = await supabase.storage
              .from('event-photos')
              .download(objectPath)

            if (downloadError || !blob) {
              skipped++
              write(controller, { type: 'failed', name: objectPath, reason: 'download_failed' })
              failedFiles.push(objectPath)
              failed++
              done++
              write(controller, { type: 'progress', done, indexed, skipped, failed })
              continue
            }

            const buffer = Buffer.from(await blob.arrayBuffer())
            if (buffer.length === 0) {
              skipped++
              write(controller, { type: 'failed', name: objectPath, reason: 'empty_file' })
              failedFiles.push(objectPath)
              failed++
              done++
              write(controller, { type: 'progress', done, indexed, skipped, failed })
              continue
            }

            const cmd = new IndexFacesCommand({
              CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
              Image: { Bytes: buffer },
              MaxFaces: 10,
              QualityFilter: 'AUTO',
              ExternalImageId: objectPath.replace(/[^\w.\-:]/g, '_'),
            })

            const result = await rekognition.send(cmd)

            const faceRecords =
              (result.FaceRecords ?? [])
                .map((r) => r.Face?.FaceId)
                .filter((id): id is string => !!id)
                .map((faceId) => ({
                  event_slug,
                  face_id: faceId,
                  image_url: objectPath, // <— OJO: columna esperada en tu DB
                })) ?? []

            if (faceRecords.length === 0) {
              // no detectó caras en esta foto (o no indexó nada)
              skipped++
              done++
              write(controller, { type: 'progress', done, indexed, skipped, failed })
              continue
            }

            const { error: dbError } = await supabase.from('event_faces').insert(faceRecords)

            if (dbError) {
              console.error('DB INSERT ERROR:', objectPath, dbError)
              failed++
              failedFiles.push(objectPath)
              write(controller, { type: 'failed', name: objectPath, reason: dbError.message })
            } else {
              indexed += faceRecords.length
            }

            done++
            write(controller, { type: 'progress', done, indexed, skipped, failed })
          } catch (e: any) {
            console.error('INDEX ERROR:', objectPath, e)
            failed++
            failedFiles.push(objectPath)
            write(controller, { type: 'failed', name: objectPath, reason: e?.message ?? 'unknown' })
            done++
            write(controller, { type: 'progress', done, indexed, skipped, failed })
            continue
          }
        }

        write(controller, { type: 'done', indexed, skipped, failed, failedFiles })
        controller.close()
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('INDEX PHOTOS ERROR:', err)
    return NextResponse.json({ error: 'Indexing failed' }, { status: 500 })
  }
}
