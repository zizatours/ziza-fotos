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

    const body = await req.json().catch(() => ({} as any))

    const expected = process.env.ADMIN_PASSWORD
    if (expected && body?.adminKey !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const title = (body?.title || '').toString()
    const location = (body?.location || '').toString()
    const eventDate = (body?.event_date || '').toString()
    let imageUrl =
      typeof body?.image_url === 'string' && body.image_url.length > 0
        ? body.image_url
        : null

    // 🚫 nunca guardar portada apuntando a event-photos (no es público)
    if (imageUrl && imageUrl.includes('/storage/v1/object/public/event-photos/')) {
      imageUrl = null
    }

    if (!eventDate) {
      return NextResponse.json({ error: 'Falta fecha del evento' }, { status: 400 })
    }

    const eventDateISO = normalizeEventDateToISO(eventDate)
    if (!eventDateISO) {
      return NextResponse.json(
        { error: 'Fecha inválida. Usa DD/MM/YYYY (ej: 20/10/2025) o YYYY-MM-DD.' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json({ error: 'Falta título del evento' }, { status: 400 })
    }

    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')

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
