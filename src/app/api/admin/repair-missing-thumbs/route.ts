import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

const ORIGINAL_BUCKET = 'event-photos'
const THUMB_BUCKET = 'event-previews'

const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
let watermarkPromise: Promise<Buffer> | null = null
const getWatermarkBuffer = () => {
  if (!watermarkPromise) watermarkPromise = readFile(watermarkPath)
  return watermarkPromise
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, attempts = 5) {
  let lastErr: any
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      if (i === attempts) break
      // backoff suave: 250ms, 500ms, 1s, 2s...
      await sleep(250 * Math.pow(2, i - 1))
    }
  }
  throw lastErr
}

async function listAll(supabase: any, bucket: string, folder: string) {
  const out: { name: string }[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) throw error
    const batch = (data ?? []).filter((x: any) => x?.name && x.name !== '.emptyFolderPlaceholder')

    out.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }

  return out
}

export async function POST(req: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        const body = await req.json().catch(() => ({}))
        const { event_slug, adminKey, attempts } = body as {
          event_slug?: string
          adminKey?: string
          attempts?: number
        }

        const expected = process.env.ADMIN_PASSWORD
        if (expected && adminKey !== expected) {
          send({ type: 'error', error: 'unauthorized' })
          controller.close()
          return
        }

        if (!event_slug) {
          send({ type: 'error', error: 'missing_params' })
          controller.close()
          return
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          send({ type: 'error', error: 'missing_env' })
          controller.close()
          return
        }

        const supabase = createClient(supabaseUrl, serviceKey)

        const maxAttempts = Number.isFinite(attempts) && (attempts as number) > 0 ? (attempts as number) : 5

        // 1) list originals (new + legacy)
        const originalsNewFolder = `eventos/${event_slug}/original`
        const originalsOldFolder = `${event_slug}`

        let originalsNew: { name: string }[] = []
        let originalsOld: { name: string }[] = []

        try {
          originalsNew = await listAll(supabase, ORIGINAL_BUCKET, originalsNewFolder)
        } catch {}
        try {
          originalsOld = await listAll(supabase, ORIGINAL_BUCKET, originalsOldFolder)
        } catch {}

        const isImage = (n: string) => /\.(jpe?g|png|webp)$/i.test(n)

        // map name -> path (prefer new)
        const originals = new Map<string, string>()
        for (const f of originalsOld) if (isImage(f.name)) originals.set(f.name, `${originalsOldFolder}/${f.name}`)
        for (const f of originalsNew) if (isImage(f.name)) originals.set(f.name, `${originalsNewFolder}/${f.name}`)

        // 2) list existing thumbs
        const thumbsFolder = `eventos/${event_slug}/thumb`
        let thumbs: { name: string }[] = []
        try {
          thumbs = await listAll(supabase, THUMB_BUCKET, thumbsFolder)
        } catch {
          thumbs = []
        }

        const existingThumbBase = new Set(
          thumbs
            .map((t) => t.name)
            .filter((n) => /\.webp$/i.test(n))
            .map((n) => n.replace(/\.webp$/i, ''))
        )

        // 3) compute missing
        const missing: { fileName: string; originalPath: string; baseName: string; thumbPath: string }[] = []
        for (const [fileName, originalPath] of originals.entries()) {
          const safeName = fileName.replace(/[/\\]/g, '_')
          const baseName = safeName.replace(/\.[^.]+$/, '')
          if (!existingThumbBase.has(baseName)) {
            missing.push({
              fileName,
              originalPath,
              baseName,
              thumbPath: `${thumbsFolder}/${baseName}.webp`,
            })
          }
        }

        send({
          type: 'start',
          totalFiles: missing.length,
          originals: originals.size,
          thumbsExisting: existingThumbBase.size,
          thumbsFolder,
        })

        if (missing.length === 0) {
          send({ type: 'done', totalFiles: 0, filesOk: 0, filesFailed: 0, filesSkipped: 0 })
          controller.close()
          return
        }

        const watermarkBuffer = await getWatermarkBuffer()

        let ok = 0
        let failed = 0

        for (let i = 0; i < missing.length; i++) {
          const it = missing[i]
          send({ type: 'file', name: it.fileName })

          try {
            await withRetry(async () => {
              // download original
              const dl = await supabase.storage.from(ORIGINAL_BUCKET).download(it.originalPath)
              if (dl.error || !dl.data) throw dl.error || new Error('download_failed')

              const input = Buffer.from(await dl.data.arrayBuffer())

              // build thumb
              const thumbBytes = await sharp(input)
                .rotate()
                .resize({ width: 900, withoutEnlargement: true })
                .composite([{ input: watermarkBuffer, tile: true, blend: 'over' }])
                .webp({ quality: 70 })
                .toBuffer()

              // upload thumb
              const up = await supabase.storage.from(THUMB_BUCKET).upload(it.thumbPath, thumbBytes, {
                contentType: 'image/webp',
                upsert: true,
                cacheControl: '31536000',
              })
              if (up.error) throw up.error
            }, maxAttempts)

            ok++
          } catch (e: any) {
            failed++
            send({ type: 'failed', name: it.fileName, error: String(e?.message || e) })
          }

          send({
            type: 'progress',
            done: i + 1,
            totalFiles: missing.length,
            filesOk: ok,
            filesFailed: failed,
            file: it.fileName,
          })
        }

        send({
          type: 'done',
          totalFiles: missing.length,
          filesOk: ok,
          filesFailed: failed,
          filesSkipped: 0,
        })

        controller.close()
      } catch (e: any) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: String(e?.message || e) }) + '\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
