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

  const sharp = (await import('sharp')).default

  // 🔒 forzamos nueva versión SIEMPRE
  const hash = crypto
    .createHash('md5')
    .update(src + '_FORCE_WATERMARK_V1')
    .digest('hex')

  const previewPath = `previews/${hash}.jpg`

  // 1️⃣ si ya existe preview, devolverlo
  const { data: existingFile, error } =
    await supabase.storage
      .from('event-previews')
      .download(previewPath)

  if (!error && existingFile) {
    const buffer = Buffer.from(await existingFile.arrayBuffer())
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  }

  // 2️⃣ descargar imagen original
  const originalRes = await fetch(src)
  const originalBuffer = Buffer.from(await originalRes.arrayBuffer())

  // 3️⃣ watermark FUERTE y repetido (evento real)
  const meta = await sharp(originalBuffer).metadata()
  const base = Math.max(meta.width ?? 2000, meta.height ?? 2000)

  // tamaño del texto proporcional a la imagen
  const fontSize = Math.round(base * 0.12) // ~480px en fotos grandes
  const step = Math.round(base * 0.35)     // distancia entre repeticiones

  const watermark = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${base}" height="${base}">
    <defs>
      <pattern
        id="wm"
        patternUnits="userSpaceOnUse"
        width="${step}"
        height="${step}"
        patternTransform="rotate(-35)"
      >
        <text
          x="0"
          y="${fontSize}"
          fill="white"
          fill-opacity="0.28"
          font-size="${fontSize}"
          font-family="sans-serif"
          font-weight="900"
          letter-spacing="8"
        >
          ZIZA FOTOS
        </text>
      </pattern>
    </defs>

    <rect width="100%" height="100%" fill="url(#wm)" />
  </svg>
  `)

  const output = await sharp(originalBuffer)
    .composite([
      {
        input: watermark,
        tile: true,
        blend: 'over',
      },
    ])
    .jpeg({ quality: 80 })
    .toBuffer()


  // 4️⃣ guardar preview
  await supabase.storage
    .from('event-previews')
    .upload(previewPath, output, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  return new Response(new Uint8Array(output), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store',
    },
  })
}
