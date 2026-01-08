import { NextRequest } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src')

  if (!src) {
    return new Response('Missing src', { status: 400 })
  }

  try {
    // 1️⃣ Descargar imagen original
    const imageRes = await fetch(src)
    if (!imageRes.ok) {
      return new Response('Image fetch failed', { status: 500 })
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    // 2️⃣ Cargar watermark PNG (YA CON TEXTO RENDERIZADO)
    const watermarkPath = path.join(
      process.cwd(),
      'public',
      'watermark.png' // 👈 ESTE ARCHIVO DEBE EXISTIR
    )

    const watermarkBuffer = await fs.readFile(watermarkPath)

    // 3️⃣ Obtener tamaño imagen original
    const baseImage = sharp(imageBuffer)
    const metadata = await baseImage.metadata()

    if (!metadata.width || !metadata.height) {
      return new Response('Invalid image', { status: 500 })
    }

    const { width, height } = metadata

    // 4️⃣ Redimensionar watermark (GRANDE)
    const wmSize = Math.floor(Math.min(width, height) * 0.6)

    const wmBuffer = await sharp(watermarkBuffer)
      .resize(wmSize)
      .ensureAlpha()
      .png()
      .toBuffer()

    // 5️⃣ Repetir watermark por TODA la imagen
    const overlays: sharp.OverlayOptions[] = []
    const step = Math.floor(wmSize * 0.9)

    for (let y = -height; y < height * 2; y += step) {
      for (let x = -width; x < width * 2; x += step) {
        overlays.push({
          input: wmBuffer,
          left: x,
          top: y,
          blend: 'over'
        })
      }
    }

    // 6️⃣ Componer imagen final
    const output = await baseImage
      .composite(overlays)
      .jpeg({ quality: 82 })
      .toBuffer()

    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (err) {
    console.error('Preview error:', err)
    return new Response('Preview error', { status: 500 })
  }
}
