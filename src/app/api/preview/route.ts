import { NextRequest } from 'next/server'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs' // IMPORTANTE para sharp

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src')

    if (!src) {
      return new Response('Missing src', { status: 400 })
    }

    // 1️⃣ Descargar imagen original
    const originalRes = await fetch(src)
    if (!originalRes.ok) {
      return new Response('Failed to fetch image', { status: 400 })
    }

    const originalBuffer = Buffer.from(await originalRes.arrayBuffer())

    // 2️⃣ Cargar watermark desde /public
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
    const watermarkBuffer = fs.readFileSync(watermarkPath)

    // 3️⃣ Procesar imagen + watermark
    const image = sharp(originalBuffer)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
      return new Response('Invalid image', { status: 400 })
    }

    const outputBuffer = await image
      .composite([
        {
          input: watermarkBuffer,
          tile: true,
          blend: 'overlay'
        }
      ])
      .jpeg({ quality: 85 })
      .toBuffer()

    // 4️⃣ DEVOLVER como Uint8Array (evita error Buffer / BodyInit)
    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (err) {
    console.error('Preview error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
