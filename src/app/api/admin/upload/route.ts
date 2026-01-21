import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import sharp from 'sharp'

export const runtime = 'nodejs'

const supabase = createAdminClient()

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const eventSlug = formData.get('event_slug') as string

  if (!eventSlug) {
    return NextResponse.json({ error: 'Missing event_slug' }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No file' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  // Guardamos original y thumb en carpetas separadas
  const safeName = file.name.replace(/[/\\]/g, '_') // evita subcarpetas raras
  const baseName = safeName.replace(/\.[^.]+$/, '') // sin extensión

  const originalPath = `eventos/${eventSlug}/original/${safeName}`
  const thumbPath = `eventos/${eventSlug}/thumb/${baseName}.webp`

  // 1) Subir ORIGINAL
  const { error: originalErr } = await supabase.storage
    .from('event-photos')
    .upload(originalPath, bytes, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
      cacheControl: '31536000',
    })

  if (originalErr) {
    if (originalErr.message.includes('The resource already exists')) {
      return NextResponse.json(
        { error: 'La foto ya existe en este evento' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Error subiendo foto' }, { status: 500 })
  }

  // 2) Generar THUMB (webp liviano para grillas)
  const thumbBytes = await sharp(bytes)
    .rotate()
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()

  // 3) Subir THUMB
  const { error: thumbErr } = await supabase.storage
    .from('event-photos')
    .upload(thumbPath, thumbBytes, {
      contentType: 'image/webp',
      upsert: true, // si se reintenta, queremos que quede consistente
      cacheControl: '31536000',
    })

  // Si falla el thumb, NO rompemos el upload del original (pero lo reportamos)
  if (thumbErr) {
    return NextResponse.json(
      { ok: true, warning: 'thumb_failed', originalPath, thumbPath },
      { status: 200 }
    )
  }

  return NextResponse.json({ ok: true, originalPath, thumbPath })
}
