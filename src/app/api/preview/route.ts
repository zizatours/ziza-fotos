export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

// 👇 usamos sharp SOLO en producción
const isDev = process.env.NODE_ENV !== 'production'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const src = searchParams.get('src')

  if (!src) {
    return new NextResponse('Missing src', { status: 400 })
  }

  // 🟢 DEV MODE (Windows friendly)
  if (isDev) {
    // usamos Supabase Image Transformation (low-res)
    const devPreview = `${src}?width=600&quality=40`
    return NextResponse.redirect(devPreview)
  }

  // 🟣 PROD MODE (Vercel)
  const sharp = (await import('sharp')).default
  const crypto = await import('crypto')
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const hash = crypto.createHash('md5').update(src).digest('hex')
  const previewPath = `previews/${hash}.jpg`

  const { data: existing } = supabase
    .storage
    .from('event-previews')
    .getPublicUrl(previewPath)

  if (existing?.publicUrl) {
    return NextResponse.redirect(existing.publicUrl)
  }

  const imageRes = await fetch(src)
  const buffer = Buffer.from(await imageRes.arrayBuffer())

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

  const output = await sharp(buffer)
    .composite([{ input: watermark, gravity: 'center' }])
    .jpeg({ quality: 80 })
    .toBuffer()

  await supabase.storage
    .from('event-previews')
    .upload(previewPath, output, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  const { data } = supabase
    .storage
    .from('event-previews')
    .getPublicUrl(previewPath)

  return NextResponse.redirect(data.publicUrl)
}
