import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const ORIGINAL_BUCKET = 'event-photos'
const THUMB_BUCKET = 'event-previews'

function isImage(name: string) {
  return /\.(jpe?g|png)$/i.test(name)
}

function baseName(file: string) {
  return file.replace(/\.[^.]+$/, '')
}

async function listAllObjects(supabase: any, bucket: string, prefix: string) {
  // Supabase list() pagina por "offset"
  const out: any[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) throw error
    if (!data || data.length === 0) break

    out.push(...data)
    if (data.length < limit) break
    offset += data.length
  }

  return out
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'missing_env' }, { status: 500 })
  }

  const expected = process.env.ADMIN_PASSWORD
  const body = await req.json().catch(() => ({} as any))
  if (expected && body?.adminKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const event_slug = String(body?.event_slug || '').trim()
  if (!event_slug) {
    return NextResponse.json({ error: 'missing_event_slug' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        const originalsPrefixNew = `eventos/${event_slug}/original`
        const originalsPrefixOld = `${event_slug}`

        const thumbsPrefix = `eventos/${event_slug}/thumb`

        // 1) Listar originales (new)
        let originals: string[] = []
        try {
          const listNew = await listAllObjects(supabase, ORIGINAL_BUCKET, originalsPrefixNew)
          originals = listNew
            .filter((x: any) => x?.name && isImage(x.name))
            .map((x: any) => x.name)
        } catch {
          originals = []
        }

        // fallback legacy si no hay nada
        if (originals.length === 0) {
          const listOld = await listAllObjects(supabase, ORIGINAL_BUCKET, originalsPrefixOld)
          originals = listOld
            .filter((x: any) => x?.name && isImage(x.name))
            .map((x: any) => x.name)
        }

        // 2) Listar thumbs existentes
        const thumbsList = await listAllObjects(supabase, THUMB_BUCKET, thumbsPrefix)
        const thumbsSet = new Set(
          thumbsList
            .filter((x: any) => x?.name && /\.webp$/i.test(x.name))
            .map((x: any) => x.name)
        )

        // 3) Calcular faltantes
        const missing: string[] = []
        for (const origName of originals) {
          const thumbName = `${baseName(origName)}.webp`
          if (!thumbsSet.has(thumbName)) missing.push(origName)
        }

        send({
          type: 'start',
          event_slug,
          originals: originals.length,
          thumbsExisting: thumbsSet.size,
          missing: missing.length,
        })

        // 4) Regenerar SOLO faltantes llamando a generate-thumb
        let ok = 0
        let failed = 0

        for (let i = 0; i < missing.length; i++) {
          const file_name = missing[i]

          send({ type: 'file', i: i + 1, total: missing.length, file_name })

          try {
            const r = await fetch(new URL('/api/admin/generate-thumb', req.url), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event_slug, file_name, adminKey: body?.adminKey }),
            })

            const j = await r.json().catch(() => null)

            if (!r.ok || !j?.ok) {
              failed++
              send({
                type: 'failed',
                file_name,
                status: r.status,
                error: j?.error || 'generate_thumb_failed',
                details: j?.details || null,
              })
            } else {
              ok++
            }
          } catch (e: any) {
            failed++
            send({
              type: 'failed',
              file_name,
              error: 'exception',
              details: String(e?.message || e),
            })
          }

          send({ type: 'progress', done: i + 1, total: missing.length, ok, failed })
        }

        send({ type: 'done', total: missing.length, ok, failed })
        controller.close()
      } catch (e: any) {
        send({ type: 'error', error: String(e?.message || e) })
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
