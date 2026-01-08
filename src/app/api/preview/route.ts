import { NextResponse } from 'next/server'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src')

    if (!src) {
      return new NextResponse('Missing src', { status: 400 })
    }

    // 1️⃣ Descargar imagen original
    const imageRes = await fetch(src)
    if (!imageRes.ok) {
      return new NextResponse('Image fetch failed', { status: 500 })
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    // 2️⃣ Cargar watermark
    const watermarkPath = path.join(
      process.cwd(),
      'public',
      'watermark.png'
    )

    if (!fs.existsSync(watermarkPath)) {
      return new NextResponse('Watermark not found', { status: 500 })
    }

    const watermarkBuffer = fs.readFileSync(watermarkPath)

    // 3️⃣ Procesar imagen base
    const baseImage = sharp(imageBuffer)

    // 4️⃣ Aplicar watermark (REPETIDO, SIN POSICIONES)
    const output = await baseImage
      .composite([
        {
          input: watermarkBuffer,
          tile: true,
          gravity: 'center',
          blend: 'over',
          opacity: 0.4
        }
      ])
      .jpeg({ quality: 85 })
      .toBuffer()

    // 5️⃣ Respuesta
    return new NextResponse(output, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (err) {
    console.error('Preview error:', err)
    return new NextResponse('Preview error', { status: 500 })
  }
}
