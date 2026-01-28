import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// ✅ originales privados
const ORIGINALS_BUCKET = 'event-photos'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Extrae {bucket, path} desde una URL de Supabase Storage:
// /storage/v1/object/(public|sign|...)/<bucket>/<path>
function parseSupabaseStorageObjectUrl(url: string) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/storage\/v1\/object\/[^/]+\/([^/]+)\/(.+)$/)
    if (!m) return null
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const wRaw = Number(searchParams.get('w') || '0')
    const w = Math.max(0, Math.min(1600, Number.isFinite(wRaw) ? wRaw : 0))
    const qRaw = Number(searchParams.get('q') || '70')
    const q = Math.max(40, Math.min(90, Number.isFinite(qRaw) ? qRaw : 70))
    const fmt = (searchParams.get('fmt') || 'jpeg').toLowerCase() // jpeg | webp

    const srcParam = (searchParams.get('src') || '').trim()
    const pathParam = (searchParams.get('path') || '').trim()

    if (!srcParam && !pathParam) {
      return new Response('Missing src/path', { status: 400 })
    }

    let inputBuffer: Buffer

    // ✅ 1) Si viene path => SIEMPRE es un path dentro de event-photos (privado)
    if (pathParam) {
      const objectPath = pathParam.replace(/^\/+/, '')

      const { data: blob, error } = await supabase.storage
        .from(ORIGINALS_BUCKET)
        .download(objectPath)

      if (error || !blob) {
        console.log('PREVIEW: download failed', error?.message || 'no blob')
        return new Response('Failed to download image', { status: 400 })
      }

      inputBuffer = Buffer.from(await blob.arrayBuffer())
      if (inputBuffer.length === 0) {
        return new Response('Empty file', { status: 400 })
      }
    } else {
      // ✅ 2) Si viene src => es URL completa
      //    Si apunta a Supabase Storage y bucket es event-photos => bajar con service role
      const parsed = /^https?:\/\//i.test(srcParam)
        ? parseSupabaseStorageObjectUrl(srcParam)
        : null

      if (parsed?.bucket === ORIGINALS_BUCKET && parsed.path) {
        const { data: blob, error } = await supabase.storage
          .from(ORIGINALS_BUCKET)
          .download(parsed.path)

        if (error || !blob) {
          console.log('PREVIEW: download failed', error?.message || 'no blob')
          return new Response('Failed to download image', { status: 400 })
        }

        inputBuffer = Buffer.from(await blob.arrayBuffer())
      } else {
        // caso normal: fetch directo (ej: event-previews público u otra URL)
        let srcUrl: URL
        try {
          srcUrl = new URL(srcParam)
        } catch {
          return new Response('Invalid src URL', { status: 400 })
        }

        const imgRes = await fetch(srcUrl.toString())
        if (!imgRes.ok) {
          const t = await imgRes.text().catch(() => '')
          console.log('PREVIEW: fetch failed', imgRes.status, t.slice(0, 200))
          return new Response('Failed to download image', { status: 400 })
        }

        inputBuffer = Buffer.from(await imgRes.arrayBuffer())
      }
    }

    // ✅ Watermark local
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
    const watermarkBuffer = await readFile(watermarkPath)

    let img = sharp(inputBuffer).rotate()

    // Resize opcional (si w > 0)
    if (w > 0) {
      img = img.resize({ width: w, withoutEnlargement: true })
    }

    // Watermark (tile)
    img = img.composite([{ input: watermarkBuffer, tile: true, blend: 'over' }])

    const isWebp = fmt === 'webp'
    const output = isWebp
      ? await img.webp({ quality: q }).toBuffer()
      : await img.jpeg({ quality: q }).toBuffer()

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': isWebp ? 'image/webp' : 'image/jpeg',
        'Cache-Control':
          'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err) {
    console.log('PREVIEW ERROR:', err)
    return new Response('Preview error', { status: 500 })
  }
}
//sd