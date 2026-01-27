import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

// De dónde leemos el original (privado)
const ORIGINAL_BUCKET = 'event-photos'
// Dónde guardamos el thumb con marca de agua (público)
const THUMB_BUCKET = 'event-previews'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { event_slug, file_name, adminKey } = body as {
      event_slug?: string
      file_name?: string
      adminKey?: string
    }

    const expected = process.env.ADMIN_PASSWORD
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (!event_slug || !file_name) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'missing_env' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const safeName = file_name.replace(/[/\\]/g, '_')
    const baseName = safeName.replace(/\.[^.]+$/, '')

    // Nuevo esquema y fallback viejo
    const originalPathNew = `eventos/${event_slug}/original/${safeName}`
    const originalPathOld = `${event_slug}/${safeName}`

    // Descargar original (new -> old)
    let blob: Blob | null = null
    const r1 = await supabase.storage.from(ORIGINAL_BUCKET).download(originalPathNew)
    if (!r1.error && r1.data) blob = r1.data
    else {
      const r2 = await supabase.storage.from(ORIGINAL_BUCKET).download(originalPathOld)
      if (!r2.error && r2.data) blob = r2.data
    }

    if (!blob) {
      return NextResponse.json(
        { error: 'original_not_found', tried: [originalPathNew, originalPathOld] },
        { status: 404 }
      )
    }

    const input = Buffer.from(await blob.arrayBuffer())

    // Watermark desde /public
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
    const watermarkBuffer = await readFile(watermarkPath)

    // Generar thumb + watermark
    const thumbBytes = await sharp(input)
      .rotate()
      .resize({ width: 900, withoutEnlargement: true })
      .composite([{ input: watermarkBuffer, tile: true, blend: 'over' }])
      .webp({ quality: 70 })
      .toBuffer()

    const thumbPath = `eventos/${event_slug}/thumb/${baseName}.webp`

    const { error: upErr } = await supabase.storage.from(THUMB_BUCKET).upload(thumbPath, thumbBytes, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })

    if (upErr) {
      return NextResponse.json({ error: 'thumb_upload_failed', details: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, thumbPath, bucket: THUMB_BUCKET })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'server_error', details: String(e?.message || e) },
      { status: 500 }
    )
  }
}
