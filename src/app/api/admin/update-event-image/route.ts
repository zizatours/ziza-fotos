import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import sharp from 'sharp'

export const runtime = 'nodejs'

// ✅ cover público
const COVER_BUCKET = 'event-previews'

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient()

    const formData = await req.formData()
    const eventSlug = String(formData.get('eventSlug') || '').trim()
    const image = formData.get('image') as File | null

    if (!eventSlug || !image) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // 1) convertir a WEBP (liviano y consistente)
    const input = Buffer.from(await image.arrayBuffer())

    const webpBuffer = await sharp(input)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()

    // 2) ruta fija (siempre la misma)
    const storagePath = `eventos/${eventSlug}/cover/cover.webp`

    // 3) subir a bucket público (upsert para reemplazar)
    const { error: uploadError } = await supabase.storage
      .from(COVER_BUCKET)
      .upload(storagePath, webpBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (uploadError) {
      console.error(uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 4) URL pública correcta
    const baseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''

    const imageUrl = `${baseUrl}/storage/v1/object/public/${COVER_BUCKET}/${storagePath}`

    // 5) guardar en DB
    const { error: updateError } = await supabase
      .from('events')
      .update({ image_url: imageUrl })
      .eq('slug', eventSlug)

    if (updateError) {
      console.error(updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, image_url: imageUrl })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
