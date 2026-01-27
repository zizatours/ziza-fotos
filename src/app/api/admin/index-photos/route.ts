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
  | { type: 'start'; totalFiles: number }
  | {
      type: 'progress'
      done: number
      totalFiles: number
      file: string
      status: 'ok' | 'skipped' | 'failed'
      filesOk: number
      filesSkipped: number
      filesFailed: number
      facesIndexedTotal: number
      facesInFile?: number
      reason?: string
    }
  | {
      type: 'done'
      totalFiles: number
      filesOk: number
      filesSkipped: number
      filesFailed: number
      facesIndexedTotal: number
      failedFiles: string[]
    }

export async function POST(req: Request) {
  try {
    const { event_slug } = await req.json()

    if (!event_slug) {
      return NextResponse.json({ error: 'Missing event_slug' }, { status: 400 })
    }

    const encoder = new TextEncoder()
    const failedFiles: string[] = []

    const write = (controller: ReadableStreamDefaultController, msg: StreamMsg) => {
      controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'))
    }

    // 1) listar TODO (paginado) desde storage/event-photos/<event_slug>/
    const allFiles: any[] = []
    let offset = 0
    const limit = 1000

    while (true) {
      const prefix = `eventos/${event_slug}/original`

      const { data, error } = await supabase.storage
        .from('event-photos')
        .list(prefix, { limit, offset })

      if (error) {
        console.error('STORAGE LIST ERROR:', error)
        return NextResponse.json({ error: 'Failed to list photos' }, { status: 500 })
      }

      const batch = data ?? []
      allFiles.push(...batch)

      if (batch.length < limit) break
      offset += limit
    }

    const candidates = allFiles
      .filter((f) => !!f?.name)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name))

    const totalFiles = candidates.length

    // ===== evitar reindexación: traer archivos ya procesados (incluye 0 caras) =====
    const alreadyIndexed = new Set<string>()
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('event_indexed_files')
        .select('image_url')
        .eq('event_slug', event_slug)
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('Error leyendo event_indexed_files para dedupe:', error)
        break
      }

      const rows = data ?? []
      for (const r of rows as any[]) {
        if (r?.image_url) alreadyIndexed.add(r.image_url)
      }

      if (rows.length < pageSize) break
      from += pageSize
    }

    const stream = new ReadableStream({
      async start(controller) {
        write(controller, { type: 'start', totalFiles })

        let done = 0
        let filesOk = 0
        let filesSkipped = 0
        let filesFailed = 0
        let facesIndexedTotal = 0

        for (const file of candidates) {
          const objectPath = `eventos/${event_slug}/original/${file.name}`

          // ===== skip si ya está indexada =====
          if (alreadyIndexed.has(objectPath)) {
            done++
            filesSkipped++

            write(controller, {
              type: 'progress',
              done,
              totalFiles,
              file: objectPath,
              status: 'skipped',
              filesOk,
              filesSkipped,
              filesFailed,
              facesIndexedTotal,
              reason: 'already_indexed',
            })

            continue
          }

          try {
            // descargar
            const { data: blob, error: downloadError } = await supabase.storage
              .from('event-photos')
              .download(objectPath)

            if (downloadError || !blob) {
              done++
              filesFailed++
              failedFiles.push(objectPath)
              write(controller, {
                type: 'progress',
                done,
                totalFiles,
                file: objectPath,
                status: 'failed',
                filesOk,
                filesSkipped,
                filesFailed,
                facesIndexedTotal,
                reason: 'download_failed',
              })
              continue
            }

            const buffer = Buffer.from(await blob.arrayBuffer())
            if (buffer.length === 0) {
              done++
              filesSkipped++
              write(controller, {
                type: 'progress',
                done,
                totalFiles,
                file: objectPath,
                status: 'skipped',
                filesOk,
                filesSkipped,
                filesFailed,
                facesIndexedTotal,
                reason: 'empty_file',
              })
              continue
            }

            // rekognition
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
                .map((r) => ({
                  event_slug,
                  face_id: r.Face?.FaceId ?? null,
                  image_url: objectPath,
                  bounding_box: r.Face?.BoundingBox ?? {}, // no-null
                  confidence: r.Face?.Confidence ?? null,
                }))
                .filter((x) => !!x.face_id)

            // insertar (si hay caras)
            if (faceRecords.length > 0) {
              const { error: dbError } = await supabase.from('event_faces').insert(faceRecords)

              if (dbError) {
                console.error('DB INSERT ERROR:', objectPath, dbError)
                done++
                filesFailed++
                failedFiles.push(objectPath)
                write(controller, {
                  type: 'progress',
                  done,
                  totalFiles,
                  file: objectPath,
                  status: 'failed',
                  filesOk,
                  filesSkipped,
                  filesFailed,
                  facesIndexedTotal,
                  facesInFile: faceRecords.length,
                  reason: dbError.message,
                })
                continue
              }

              facesIndexedTotal += faceRecords.length
            }

            // ===== marcar archivo como procesado (aunque tenga 0 caras) =====
            const { error: markErr } = await supabase
              .from('event_indexed_files')
              .upsert(
                {
                  event_slug,
                  image_url: objectPath,
                  faces_count: faceRecords.length,
                  indexed_at: new Date().toISOString(),
                },
                { onConflict: 'event_slug,image_url' }
              )

            if (markErr) {
              console.error('event_indexed_files upsert error:', objectPath, markErr)
            }

            // también lo marcamos en memoria para esta misma corrida
            alreadyIndexed.add(objectPath)

            // ✅ ARCHIVO OK (aunque tenga 0 caras, el archivo igual fue procesado)
            done++
            filesOk++
            write(controller, {
              type: 'progress',
              done,
              totalFiles,
              file: objectPath,
              status: 'ok',
              filesOk,
              filesSkipped,
              filesFailed,
              facesIndexedTotal,
              facesInFile: faceRecords.length,
            })
          } catch (e: any) {
            console.error('INDEX ERROR:', objectPath, e)
            done++
            filesFailed++
            failedFiles.push(objectPath)
            write(controller, {
              type: 'progress',
              done,
              totalFiles,
              file: objectPath,
              status: 'failed',
              filesOk,
              filesSkipped,
              filesFailed,
              facesIndexedTotal,
              reason: e?.message ?? 'unknown',
            })
          }
        }

        write(controller, {
          type: 'done',
          totalFiles,
          filesOk,
          filesSkipped,
          filesFailed,
          facesIndexedTotal,
          failedFiles,
        })

        controller.close()
      },
    })

    // ✅ ESTA ES LA PARTE CLAVE: devolver el stream NDJSON
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
