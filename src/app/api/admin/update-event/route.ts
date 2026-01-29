import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// helper: normalizar fecha a ISO (YYYY-MM-DD)
const normalizeEventDateToISO = (raw: string) => {
  const s = (raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null

  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  const yyyy = m[3]
  const iso = `${yyyy}-${mm}-${dd}`

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

    const slug = (body?.event_slug || '').toString().trim()
    const name = (body?.name || '').toString().trim()
    const location = (body?.location || '').toString().trim()
    const eventDateRaw = (body?.event_date || '').toString().trim()
    const imageUrl =
    typeof body?.image_url === 'string' && body.image_url.length > 0
      ? body.image_url
      : null

    if (!slug) return NextResponse.json({ error: 'missing_event_slug' }, { status: 400 })
    if (!name && !location && !eventDateRaw && !imageUrl) {
      return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
    }

    const patch: any = {}
    if (name) patch.name = name
    if (location) patch.location = location
    if (imageUrl) patch.image_url = imageUrl

    if (eventDateRaw) {
      const iso = normalizeEventDateToISO(eventDateRaw)
      if (!iso) {
        return NextResponse.json(
          { error: 'Fecha inválida. Usa YYYY-MM-DD o DD/MM/YYYY.' },
          { status: 400 }
        )
      }
      patch.event_date = iso
    }

    const { error } = await supabase
      .from('events')
      .update(patch)
      .eq('slug', slug)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
