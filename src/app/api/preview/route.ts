export const runtime = 'nodejs'

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const src = searchParams.get('src')

  if (!src) {
    return new Response('Missing src', { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const isDev = process.env.NODE_ENV !== 'production'

  /* -------------------------------------------------
     🟢 DEV MODE (Windows / Turbopack friendly)
     - NO sharp
     - Solo devuelve imagen original (sin exponer URL)
  -------------------------------------------------- */
  if (isDev) {
    const res = await fetch(src)
    const buffer = Buffer.from(await res.arrayBuffer())

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  }

  /* -------------------------------------------------
     🟣 PROD MODE (Vercel)
     - Watermark con sharp
     - Cache en bucket event-previews
  -------------------------------------------------- */

  const sharp = (await import('sharp')).default

  const hash = crypto
    .createHash('md5')
    .update(src + '_v2_watermark')
    .digest('hex')

  const previewPath = `previews/${hash}.jpg`

  // 1️⃣ ¿EXISTE PREVIEW?
  const { data: existingFile, error } =
    await supabase.storage
      .from('event-previews')
      .download(previewPath)

  if (!error && existingFile) {
    const buffer = Buffer.from(await existingFile.arrayBuffer())

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // 2️⃣ DESCARGAR ORIGINAL
  const originalRes = await fetch(src)
  const originalBuffer = Buffer.from(await originalRes.arrayBuffer())

  // 3️⃣ WATERMARK
  const watermark = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">
    <defs>
      <pattern
        id="wm"
        patternUnits="userSpaceOnUse"
        width="300"
        height="300"
        patternTransform="rotate(-30)"
      >
        <text
          x="0"
          y="160"
          fill="white"
          fill-opacity="0.25"
          font-size="48"
          font-family="sans-serif"
          font-weight="700"
        >
          ZIZA FOTOS
        </text>
      </pattern>
    </defs>

    <rect width="100%" height="100%" fill="url(#wm)" />
  </svg>
  `)

  const output = await sharp(originalBuffer)
    .composite([{ input: watermark, gravity: 'center' }])
    .jpeg({ quality: 80 })
    .toBuffer()

  // 4️⃣ SUBIR PREVIEW
  await supabase.storage
    .from('event-previews')
    .upload(previewPath, output, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  return new Response(new Uint8Array(output), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
