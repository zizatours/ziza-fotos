export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const src = searchParams.get('src')

  if (!src) {
    return new NextResponse('Missing src', { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const isDev = process.env.NODE_ENV !== 'production'

  // 🟢 DEV: solo baja la imagen y la devuelve (sin sharp)
  if (isDev) {
    const res = await fetch(src)
    const buffer = Buffer.from(await res.arrayBuffer())

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  }

  // 🟣 PROD
  const sharp = (await import('sharp')).default

  const hash = crypto.createHash('md5').update(src).digest('hex')
  const previewPath = `previews/${hash}.jpg`

  // 1️⃣ ¿Existe preview?
  const { data: existingFile, error } =
    await supabase.storage
      .from('event-previews')
      .download(previewPath)

  if (!error && existingFile) {
    const buffer = Buffer.from(await existingFile.arrayBuffer())

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // 2️⃣ Generar preview
  const originalRes = await fetch(src)
  const originalBuffer = Buffer.from(await originalRes.arrayBuffer())

  const watermark = Buffer.from(`
    <svg width="500" height="300">
      <text x="50%" y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="white"
        opacity="0.35"
        font-size="42"
        font-family="Arial">
        ZIZA FOTOS
      </text>
    </svg>
  `)

  const output = await sharp(originalBuffer)
    .composite([{ input: watermark, gravity: 'center' }])
    .jpeg({ quality: 80 })
    .toBuffer()

  await supabase.storage
    .from('event-previews')
    .upload(previewPath, output, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  return new NextResponse(output, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
