import {
  RekognitionClient,
  IndexFacesCommand,
} from '@aws-sdk/client-rekognition'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

type Msg =
  | { type: 'start'; total: number }
  | { type: 'progress'; i: number; total: number; file: string; status: 'indexed' | 'skipped' | 'failed'; faces?: number; reason?: string }
  | { type: 'done'; indexed: number; skipped: number; failed: number; failedFiles: string[] }
  | { type: 'error'; message: string }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const event_slug = (body?.event_slug ?? '').toString().trim()

    if (!event_slug) {
      return new Response(JSON.stringify({ error: 'Missing event_slug' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 1) Listar fotos del evento
    const { data: files, error: listError } = await supabase.storage
      .from('event-photos')
      .list(event_slug)

    if (listError) {
      console.error('STORAGE LIST ERROR:', listError)
      return new Response(JSON.stringify({ error: 'Failed to list photos' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const candidates = (files ?? [])
      .filter((f) => !!f?.name)
      .filter((f: any) => (f?.metadata?.size ?? 1) > 0)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name))

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (msg: Msg) => {
          controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'))
        }

        let indexed = 0
        let skipped = 0
        let failed = 0
        const failedFiles: string[] = []

        write({ type: 'start', total: candidates.length })

        for (let i = 0; i < candidates.length; i++) {
          if (req.signal.aborted) break

          const file = candidates[i]
          const objectPath = `${event_slug}/${file.name}`

          try {
            const { data: blob, error: downloadError } = await supabase.storage
              .from('event-photos')
              .download(objectPath)

            if (downloadError || !blob) {
              skipped++
              write({
                type: 'progress',
                i: i + 1,
                total: candidates.length,
                file: objectPath,
                status: 'skipped',
                reason: 'download_failed',
              })
              continue
            }

            const buffer = Buffer.from(await blob.arrayBuffer())

            if (buffer.length === 0) {
              skipped++
              write({
                type: 'progress',
                i: i + 1,
                total: candidates.length,
                file: objectPath,
                status: 'skipped',
                reason: 'empty_file',
              })
              continue
            }

            const command = new IndexFacesCommand({
              CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
              Image: { Bytes: buffer },
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
              write({
                type: 'progress',
                i: i + 1,
                total: candidates.length,
                file: objectPath,
                status: 'skipped',
                reason: 'no_faces',
              })
              continue
            }

            const { error: dbError } = await supabase
              .from('event_faces')
              .insert(faceRecords)

            if (dbError) {
              failed++
              failedFiles.push(objectPath)
              write({
                type: 'progress',
                i: i + 1,
                total: candidates.length,
                file: objectPath,
                status: 'failed',
                reason: 'db_insert_error',
              })
              continue
            }

            indexed += faceRecords.length
            write({
              type: 'progress',
              i: i + 1,
              total: candidates.length,
              file: objectPath,
              status: 'indexed',
              faces: faceRecords.length,
            })
          } catch (e) {
            console.error('INDEX ERROR:', objectPath, e)
            failed++
            failedFiles.push(objectPath)
            write({
              type: 'progress',
              i: i + 1,
              total: candidates.length,
              file: objectPath,
              status: 'failed',
              reason: 'exception',
            })
            continue
          }
        }

        write({ type: 'done', indexed, skipped, failed, failedFiles })
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('INDEX PHOTOS ERROR:', err)
    return new Response(JSON.stringify({ error: 'Indexing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
