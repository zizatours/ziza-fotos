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
  const WIDTH = 900
  const QUALITY = 70

  // Texto watermark (puedes cambiarlo)
  const wmText = 'ZIZA PHOTOGRAPHY'

  // SVG watermark (se repite con composite + tile)
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="250">
    <style>
      .t { fill: rgba(255,255,255,0.35); font-size: 44px; font-family: Arial, sans-serif; font-weight: 700; }
    </style>
    <text x="20" y="140" class="t" transform="rotate(-20 20 140)">${wmText}</text>
  </svg>
  `
  const wm = Buffer.from(svg)

  const base = sharp(bytes)
    .rotate()
    .resize({ width: WIDTH, withoutEnlargement: true })

  // Creamos una “capa” del mismo tamaño para poder tilear
  const meta = await base.metadata()
  const W = meta.width || WIDTH
  const H = meta.height || Math.round((WIDTH * 3) / 4)

  const tile = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: wm, top: 40, left: 40 },
      { input: wm, top: Math.round(H / 2), left: Math.round(W / 3) },
    ])
    .png()
    .toBuffer()

  const thumbBytes = await base
    .composite([{ input: tile, blend: 'over' }])
    .webp({ quality: QUALITY })
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
