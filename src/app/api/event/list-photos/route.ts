import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const BUCKET = 'event-photos'

// Intenta listar en carpeta nueva: eventos/<slug>/original
// Si no existe (eventos viejos), cae a <slug>/
async function listWithFallback(supabase: any, slug: string, limit: number, offset: number) {
  // 1) Nuevo esquema
  const prefixNew = `eventos/${slug}/original`
  const r1 = await supabase.storage.from(BUCKET).list(prefixNew, {
    limit,
    offset,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (Array.isArray(r1.data) && r1.data.length > 0 && !r1.error) {
    return { mode: 'new' as const, prefix: prefixNew, data: r1.data, error: r1.error }
  }

  // 2) Esquema viejo (raíz del evento)
  const prefixOld = `${slug}`
  const r2 = await supabase.storage.from(BUCKET).list(prefixOld, {
    limit,
    offset,
    sortBy: { column: 'name', order: 'asc' },
  })

  return { mode: 'old' as const, prefix: prefixOld, data: r2.data, error: r2.error }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const eventSlug = (searchParams.get('event_slug') || '').trim()
    const limit = Math.max(12, Math.min(60, Number(searchParams.get('limit') || '24')))
    const offset = Math.max(0, Number(searchParams.get('offset') || '0'))

    if (!eventSlug) {
      return NextResponse.json({ error: 'missing_event_slug' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const listed = await listWithFallback(supabase, eventSlug, limit, offset)
    if (listed.error) {
      return NextResponse.json({ error: 'list_failed', details: listed.error.message }, { status: 500 })
    }

    const items = (listed.data || [])
      .filter((x: any) => x?.name && !String(x.name).startsWith('.')) // ignora placeholders raros
      .map((x: any) => {
        const name = String(x.name)
        const baseName = name.replace(/\.[^.]+$/, '')

        if (listed.mode === 'new') {
          const originalPath = `eventos/${eventSlug}/original/${name}`
          const thumbPath = `eventos/${eventSlug}/thumb/${baseName}.webp`
          return { originalPath, thumbPath }
        }

        // modo viejo: no hay thumbs garantizados
        const originalPath = `${eventSlug}/${name}`
        return { originalPath, thumbPath: null as string | null }
      })

    const nextOffset = items.length < limit ? null : offset + limit

    return NextResponse.json({ items, nextOffset })
  } catch (e) {
    console.log('list-photos error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
