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

// Cache simple del watermark (evita readFile en cada request)
const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
let watermarkPromise: Promise<Buffer> | null = null
const getWatermarkBuffer = () => {
  if (!watermarkPromise) watermarkPromise = readFile(watermarkPath)
  return watermarkPromise
}

// ===== retry helper =====
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    tries?: number
    baseMs?: number
    maxMs?: number
    label?: string
    shouldRetry?: (err: any) => boolean
  } = {}
): Promise<T> {
  const tries = opts.tries ?? 5
  const baseMs = opts.baseMs ?? 350
  const maxMs = opts.maxMs ?? 4000
  const label = opts.label ?? 'op'
  const shouldRetry =
    opts.shouldRetry ??
    (() => true) // por defecto: reintenta todo (seguro para nuestras ops)

  let lastErr: any = null

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err

      const canRetry = attempt < tries && shouldRetry(err)
      console.log(
        `generate-thumb retry: ${label} attempt ${attempt}/${tries} failed:`,
        err?.message || err
      )

      if (!canRetry) break

      // backoff exponencial + jitter
      const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1))
      const jitter = Math.floor(Math.random() * 120)
      await sleep(exp + jitter)
    }
  }

  throw lastErr
}

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

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
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

    // ===== 1) descargar original (reintentos) =====
    const downloadOriginal = async () => {
      // new -> old
      const r1 = await supabase.storage
        .from(ORIGINAL_BUCKET)
        .download(originalPathNew)
      if (!r1.error && r1.data) return r1.data

      const r2 = await supabase.storage
        .from(ORIGINAL_BUCKET)
        .download(originalPathOld)
      if (!r2.error && r2.data) return r2.data

      // si no existe de verdad, esto NO lo arregla reintentando
      const e = new Error(
        `original_not_found tried: ${originalPathNew} | ${originalPathOld}`
      )
      ;(e as any).code = 'ORIGINAL_NOT_FOUND'
      throw e
    }

    let blob: Blob
    try {
      blob = await withRetry(downloadOriginal, {
        label: 'download_original',
        tries: 5,
        shouldRetry: (err) => err?.code !== 'ORIGINAL_NOT_FOUND',
      })
    } catch (e: any) {
      if (e?.code === 'ORIGINAL_NOT_FOUND') {
        return NextResponse.json(
          { error: 'original_not_found', tried: [originalPathNew, originalPathOld] },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'original_download_failed', details: String(e?.message || e) },
        { status: 500 }
      )
    }

    const input = Buffer.from(await blob.arrayBuffer())
    if (input.length === 0) {
      return NextResponse.json({ error: 'empty_original' }, { status: 400 })
    }

    // ===== 2) watermark (cacheado) =====
    let watermarkBuffer: Buffer
    try {
      watermarkBuffer = await getWatermarkBuffer()
    } catch {
      return NextResponse.json(
        { error: 'watermark_missing', details: 'No pude leer public/watermark.png' },
        { status: 500 }
      )
    }

    // ===== 3) generar thumb (reintentos) =====
    const makeThumb = async () => {
      return await sharp(input)
        .rotate()
        .resize({ width: 900, withoutEnlargement: true })
        .composite([{ input: watermarkBuffer, tile: true, blend: 'over' }])
        .webp({ quality: 70 })
        .toBuffer()
    }

    let thumbBytes: Buffer
    try {
      thumbBytes = await withRetry(makeThumb, {
        label: 'sharp_render',
        tries: 5,
      })
    } catch (e: any) {
      return NextResponse.json(
        { error: 'thumb_render_failed', details: String(e?.message || e) },
        { status: 500 }
      )
    }

    const thumbPath = `eventos/${event_slug}/thumb/${baseName}.webp`

    // ===== 4) subir thumb (reintentos) =====
    const uploadThumb = async () => {
      const { error } = await supabase.storage
        .from(THUMB_BUCKET)
        .upload(thumbPath, thumbBytes, {
          contentType: 'image/webp',
          upsert: true,
          cacheControl: '31536000',
        })
      if (error) throw error
      return true
    }

    try {
      await withRetry(uploadThumb, { label: 'upload_thumb', tries: 5 })
    } catch (e: any) {
      return NextResponse.json(
        { error: 'thumb_upload_failed', details: String(e?.message || e) },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, thumbPath, bucket: THUMB_BUCKET })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'server_error', details: String(e?.message || e) },
      { status: 500 }
    )
  }
}
