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
      <rect width="100%" height="100%" fill="rgba(255,0,0,0.25)" />
      <text
        x="50%"
        y="50%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="160"
        fill="white"
        font-family="sans-serif"
        font-weight="900"
      >
        TEST ZIZA
      </text>
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
