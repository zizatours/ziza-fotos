import { NextRequest } from 'next/server'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src')

    if (!src) {
      return new Response('Missing src', { status: 400 })
    }

    // 1️⃣ Descargar imagen original
    const imgRes = await fetch(src)
    if (!imgRes.ok) {
      return new Response('Failed to fetch image', { status: 400 })
    }

    const imgArrayBuffer = await imgRes.arrayBuffer()
    const imageBuffer = Buffer.from(imgArrayBuffer)

    const baseImage = sharp(imageBuffer)
    const metadata = await baseImage.metadata()

    if (!metadata.width || !metadata.height) {
      return new Response('Invalid image', { status: 400 })
    }

    // 2️⃣ Cargar watermark local
    const watermarkPath = path.join(
      process.cwd(),
      'public',
      'watermark',
      'ziza-watermark.png'
    )

    if (!fs.existsSync(watermarkPath)) {
      return new Response('Watermark not found', { status: 500 })
    }

    const watermarkBuffer = fs.readFileSync(watermarkPath)

    // 3️⃣ Preparar watermark repetido
    const wmSize = Math.floor(Math.min(metadata.width, metadata.height) * 0.35)

    const tiledWatermark = await sharp(watermarkBuffer)
      .resize(wmSize)
      .ensureAlpha()
      .linear(1, -0.4) // 👈 baja la opacidad real
      .png()
      .toBuffer()

    const composites: sharp.OverlayOptions[] = []

    const stepX = wmSize * 1.4
    const stepY = wmSize * 1.4

    for (let y = 0; y < metadata.height; y += stepY) {
      for (let x = 0; x < metadata.width; x += stepX) {
        composites.push({
          input: tiledWatermark,
          left: Math.floor(x),
          top: Math.floor(y),
          blend: 'overlay',
        })
      }
    }

    // 4️⃣ Componer imagen final
    const outputBuffer = await baseImage
      .composite(composites)
      .jpeg({ quality: 82 })
      .toBuffer()

    // 🔴 CLAVE: convertir Buffer → Uint8Array
    const body = new Uint8Array(outputBuffer)

    return new Response(body, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Robots-Tag': 'noindex'
      }
    })
  } catch (err) {
    console.error('Preview error:', err)
    return new Response('Preview error', { status: 500 })
  }
}
