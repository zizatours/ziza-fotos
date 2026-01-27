import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// ===== helper: normalizar fecha a ISO (YYYY-MM-DD) =====
const normalizeEventDateToISO = (raw: string) => {
  const s = (raw || '').trim()

  // Ya viene en ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Formato esperado: DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null

  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  const yyyy = m[3]

  const month = Number(mm)
  const day = Number(dd)
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const iso = `${yyyy}-${mm}-${dd}`

  // valida fecha real (evita 31/02, etc.)
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null

  const check =
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  if (check !== iso) return null

  return iso
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient()

    const formData = await req.formData()
    const title = formData.get('title') as string
    const location = formData.get('location') as string
    const eventDate = formData.get('event_date') as string
    if (!eventDate) {
      return NextResponse.json(
        { error: 'Falta fecha del evento' },
        { status: 400 }
      )
    }

    const eventDateISO = normalizeEventDateToISO(eventDate)
    if (!eventDateISO) {
      return NextResponse.json(
        { error: 'Fecha inválida. Usa DD/MM/YYYY (ej: 20/10/2025) o YYYY-MM-DD.' },
        { status: 400 }
      )
    }

    const image = formData.get('image') as File | null

    if (!title) {
      return NextResponse.json(
        { error: 'Falta título del evento' },
        { status: 400 }
      )
    }

    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')

    let imageUrl: string | null = null

    if (image) {
      const sharp = (await import('sharp')).default
      const { readFile } = await import('fs/promises')
      const path = await import('path')

      const input = Buffer.from(await image.arrayBuffer())

      // ✅ watermark desde /public/watermark.png
      const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
      const watermarkBuffer = await readFile(watermarkPath)

      // ✅ guardamos la portada como webp liviano + watermark
      const coverBytes = await sharp(input)
        .rotate()
        .resize({ width: 1400, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      // ✅ bucket público para previews/portadas/thumbs
      const PREVIEW_BUCKET = 'event-previews'
      const coverPath = `eventos/${slug}/cover/cover.webp`

      const { error } = await supabase.storage
        .from(PREVIEW_BUCKET)
        .upload(coverPath, coverBytes, {
          contentType: 'image/webp',
          upsert: true,
          cacheControl: '31536000',
        })

      if (error) {
        console.error(error)
      } else {
        imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PREVIEW_BUCKET}/${coverPath}`
      }
    }

    const { error } = await supabase.from('events').insert({
      name: title,
        slug,
        location,
        event_date: eventDateISO,
        image_url: imageUrl,
      })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, slug })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}
