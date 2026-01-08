import { NextResponse } from 'next/server'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('path')

    if (!src) {
      return new NextResponse('Missing path', { status: 400 })
    }

    // 🔑 construir URL pública real de Supabase
    const publicUrl = `https://hmmkonpbencybsbwfdfr.supabase.co/storage/v1/object/public/event-photos/${src}`

    // 1️⃣ Descargar imagen original
    const imageRes = await fetch(publicUrl)

    if (!imageRes.ok) {
      return new NextResponse('Image fetch failed', { status: 500 })
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    // 2️⃣ Cargar watermark
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')

    if (!fs.existsSync(watermarkPath)) {
      return new NextResponse('Watermark not found', { status: 500 })
    }

    const watermarkBuffer = fs.readFileSync(watermarkPath)

    // 3️⃣ Componer imagen
    const output = await sharp(imageBuffer)
      .composite([
        {
          input: watermarkBuffer,
          tile: true,
          gravity: 'center',
          blend: 'over'
        }
      ])
      .jpeg({ quality: 85 })
      .toBuffer()

    // 4️⃣ RESPUESTA (👈 AQUÍ ESTÁ LA CLAVE)
    return new NextResponse(new Uint8Array(output), {
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
