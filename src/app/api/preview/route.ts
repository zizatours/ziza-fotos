import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const src = searchParams.get('src')

  if (!src) {
    return new NextResponse('Missing src', { status: 400 })
  }

  try {
    // 1️⃣ Descargar imagen original
    const imageRes = await fetch(src)
    if (!imageRes.ok) {
      return new NextResponse('Image fetch failed', { status: 400 })
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    // 2️⃣ Obtener metadata
    const baseImage = sharp(imageBuffer)
    const metadata = await baseImage.metadata()

    const width = metadata.width || 1200
    const height = metadata.height || 800

    // 3️⃣ Crear SVG de watermark (GRANDE + REPETIDO)
    const watermarkSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="wm"
            patternUnits="userSpaceOnUse"
            width="400"
            height="400"
            patternTransform="rotate(-30)"
          >
            <text
              x="0"
              y="200"
              font-size="48"
              fill="rgba(255,255,255,0.35)"
              font-family="Arial, Helvetica, sans-serif"
            >
              ZizaPhotography
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wm)" />
      </svg>
    `

    // 4️⃣ Componer imagen + watermark
    const outputBuffer = await baseImage
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          blend: 'over',
        },
      ])
      .jpeg({ quality: 80 })
      .toBuffer()

    // 5️⃣ RESPUESTA CORRECTA (🔴 ESTA LÍNEA ARREGLA TU ERROR DE TS)
    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Preview error:', err)
    return new NextResponse('Internal error', { status: 500 })
  }
}
