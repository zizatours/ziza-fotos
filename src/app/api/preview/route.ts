import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const src = req.nextUrl.searchParams.get('src')
    if (!src) {
      return new NextResponse('Missing src', { status: 400 })
    }

    // 1. Descargar imagen original
    const originalRes = await fetch(src)
    if (!originalRes.ok) {
      return new NextResponse('Image not found', { status: 404 })
    }

    const originalBuffer = Buffer.from(await originalRes.arrayBuffer())

    // 2. Cargar watermark desde /public
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
    const watermarkBuffer = await fs.readFile(watermarkPath)

    const image = sharp(originalBuffer)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
      return new NextResponse('Invalid image', { status: 500 })
    }

    // 3. Crear patrón repetido
    const tileSize = 400 // tamaño del patrón
    const tiledWatermark = await sharp({
      create: {
        width: tileSize,
        height: tileSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        {
          input: await sharp(watermarkBuffer)
            .resize(tileSize * 0.8)
            .rotate(-30)
            .png()
            .toBuffer(),
          gravity: 'center'
        }
      ])
      .png()
      .toBuffer()

    const pattern = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(
        Array.from(
          { length: Math.ceil(metadata.width / tileSize) * Math.ceil(metadata.height / tileSize) },
          (_, i) => ({
            input: tiledWatermark,
            left: (i % Math.ceil(metadata.width / tileSize)) * tileSize,
            top: Math.floor(i / Math.ceil(metadata.width / tileSize)) * tileSize
          })
        )
      )
      .png()
      .toBuffer()

    // 4. Aplicar watermark a la imagen
    const output = await image
      .composite([
        {
          input: pattern,
          blend: 'overlay'
        }
      ])
      .jpeg({ quality: 82 })
      .toBuffer()

    return new NextResponse(output, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (err) {
    console.error('Preview error:', err)
    return new NextResponse('Internal error', { status: 500 })
  }
}
