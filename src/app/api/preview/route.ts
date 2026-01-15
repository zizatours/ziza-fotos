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

    // Aplicar watermark (tile)
    const output = await sharp(inputBuffer)
      .composite([{ input: watermarkBuffer, tile: true, blend: 'over' }])
      .jpeg({ quality: 85 })
      .toBuffer()

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/jpeg',
        // cache suave
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    console.log('PREVIEW ERROR:', err)
    return new Response('Preview error', { status: 500 })
  }
}
