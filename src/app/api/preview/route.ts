import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

const BUCKET = 'event-photos'

function buildPublicUrl(pathOrUrl: string) {
  if (!pathOrUrl) return ''

  // Si ya es URL completa, úsala
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl

  // Si es path tipo "evento/foto.jpg", conviértelo a public URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return pathOrUrl

  const clean = pathOrUrl.replace(/^\/+/, '')
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${clean}`
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const w = Math.max(200, Math.min(1600, Number(searchParams.get('w') || '0'))) // 0 = no resize
    const q = Math.max(40, Math.min(90, Number(searchParams.get('q') || '70')))
    const fmt = (searchParams.get('fmt') || 'jpeg').toLowerCase() // jpeg | webp

    // Acepta ambos: src o path (para que no se rompa si el front cambia)
    const raw = (searchParams.get('src') ?? searchParams.get('path') ?? '').trim()
    if (!raw) return new Response('Missing src/path', { status: 400 })

    const src = buildPublicUrl(raw).replace(/ /g, '%20')

    // Validación URL
    let srcUrl: URL
    try {
      srcUrl = new URL(src)
    } catch {
      return new Response('Invalid src URL', { status: 400 })
    }

    // Descargar imagen
    const imgRes = await fetch(srcUrl.toString())
    if (!imgRes.ok) {
      const t = await imgRes.text().catch(() => '')
      console.log('PREVIEW: fetch failed', imgRes.status, t.slice(0, 200))
      return new Response('Failed to download image', { status: 400 })
    }

    const inputBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Watermark local
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
    const watermarkBuffer = await readFile(watermarkPath)

    // Base
    let img = sharp(inputBuffer).rotate()

    // Resize opcional (si w > 0)
    if (w > 0) {
      img = img.resize({ width: w, withoutEnlargement: true })
    }

    // Watermark (tile) - la misma que ya usabas
    img = img.composite([{ input: watermarkBuffer, tile: true, blend: 'over' }])

    // Encode según fmt / calidad q
    const isWebp = fmt === 'webp'
    const output = isWebp
      ? await img.webp({ quality: q }).toBuffer()
      : await img.jpeg({ quality: q }).toBuffer()

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': isWebp ? 'image/webp' : 'image/jpeg',
        // cache más fuerte (sube velocidad MUCHO)
        'Cache-Control': 'public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err) {
    console.log('PREVIEW ERROR:', err)
    return new Response('Preview error', { status: 500 })
  }
}
