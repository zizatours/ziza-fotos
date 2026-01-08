import { NextRequest } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src')

    if (!src) {
      return new Response('Missing src', { status: 400 })
    }

    // Descargar imagen original
    const originalRes = await fetch(src)
    if (!originalRes.ok) {
      return new Response('Failed to fetch image', { status: 500 })
    }

    const imageBuffer = Buffer.from(await originalRes.arrayBuffer())

    // Obtener dimensiones reales
    const metadata = await sharp(imageBuffer).metadata()
    const width = metadata.width || 1200
    const height = metadata.height || 800

    // Watermark grande, repetido y diagonal
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="wm"
            patternUnits="userSpaceOnUse"
            width="500"
            height="500"
            patternTransform="rotate(-30)"
          >
            <text
              x="0"
              y="180"
              fill="rgba(255,255,255,0.28)"
              font-size="96"
              font-weight="900"
              font-family="sans-serif"
            >
              ZIZA FOTOS
            </text>
            <text
              x="40"
              y="320"
              fill="rgba(255,255,255,0.28)"
              font-size="96"
              font-weight="900"
              font-family="sans-serif"
            >
              ZIZA FOTOS
            </text>
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#wm)" />
      </svg>
      `

    const output = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(svg),
          blend: 'over',
        },
      ])
      .jpeg({ quality: 82 })
      .toBuffer()

    // ⚠️ USAR Response, NO NextResponse
    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[preview error]', err)
    return new Response('Internal error', { status: 500 })
  }
}
