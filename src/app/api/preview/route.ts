import { NextRequest } from 'next/server'
import sharp from 'sharp'

export async function GET(req: NextRequest) {
  try {
    const src = req.nextUrl.searchParams.get('src')
    if (!src) {
      return new Response('Missing src', { status: 400 })
    }

    // 1️⃣ Descargar imagen original
    const originalRes = await fetch(src)
    const originalBuffer = Buffer.from(await originalRes.arrayBuffer())

    const baseImage = sharp(originalBuffer)
    const metadata = await baseImage.metadata()

    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image dimensions')
    }

    // 2️⃣ Cargar watermark
    const watermarkRes = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/watermark.png`
    )
    const watermarkBuffer = Buffer.from(await watermarkRes.arrayBuffer())

    // 3️⃣ Redimensionar watermark RELATIVO a la imagen
    const watermarkWidth = Math.floor(metadata.width * 0.35)

    const resizedWatermark = await sharp(watermarkBuffer)
      .resize(watermarkWidth)
      .png()
      .toBuffer()

    // 4️⃣ Tile manual (repetir watermark)
    const tileX = Math.ceil(metadata.width / watermarkWidth)
    const tileY = Math.ceil(metadata.height / watermarkWidth)

    const overlays = []
    for (let y = 0; y < tileY; y++) {
      for (let x = 0; x < tileX; x++) {
        overlays.push({
          input: resizedWatermark,
          left: x * watermarkWidth,
          top: y * watermarkWidth,
          blend: 'overlay'
        })
      }
    }

    // 5️⃣ Componer imagen final
    const output = await baseImage
      .composite(overlays)
      .jpeg({ quality: 85 })
      .toBuffer()

    return new Response(output, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store'
      }
    })
  } catch (err) {
    console.error('Preview error:', err)
    return new Response('Preview failed', { status: 500 })
  }
}
