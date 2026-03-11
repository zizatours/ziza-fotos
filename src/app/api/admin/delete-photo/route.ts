import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const PHOTO_BUCKET = 'event-photos'
const PREVIEW_BUCKET = 'event-previews'

function cleanPath(v: string) {
  return (v || '').replace(/^\/+/, '').trim()
}

function deriveThumbPath(originalPath: string, eventSlug: string) {
  const clean = cleanPath(originalPath)
  const file = clean.split('/').pop() || ''
  const base = file.replace(/\.[^.]+$/, '')
  if (!base) return null

  // nuevo: eventos/<slug>/original/<file>
  const mNew = clean.match(/^eventos\/([^/]+)\/original\/(.+)$/)
  if (mNew) {
    const slug = mNew[1]
    return `eventos/${slug}/thumb/${base}.webp`
  }

  // legacy: <slug>/<file>  -> thumbs públicos siguen esquema nuevo
  const mOld = clean.match(/^([^/]+)\/(.+)$/)
  if (mOld) {
    const slug = mOld[1]
    return `eventos/${slug}/thumb/${base}.webp`
  }

  // fallback por event slug (por si viene algo raro pero válido)
  if (eventSlug && base) {
    return `eventos/${eventSlug}/thumb/${base}.webp`
  }

  return null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const eventSlug = String(body?.event_slug || '').trim()
    const originalPath = cleanPath(String(body?.original_path || body?.originalPath || ''))

    const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY
    if (expected) {
      const got = req.headers.get('x-admin-key') || body?.adminKey
      if (!got || got !== expected) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
    }

    if (!eventSlug) {
      return NextResponse.json({ error: 'missing_event_slug' }, { status: 400 })
    }

    if (!originalPath) {
      return NextResponse.json({ error: 'missing_original_path' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null

    const ua = req.headers.get('user-agent') || null

    await supabase.from('admin_audit_log').insert({
      action: 'delete_photo',
      event_slug: eventSlug,
      target_path: originalPath,
      ip,
      user_agent: ua,
    })

    // Seguridad básica: el path debe corresponder al evento (nuevo o legacy)
    const validForEvent =
      originalPath.startsWith(`eventos/${eventSlug}/original/`) ||
      originalPath.startsWith(`${eventSlug}/`)

    if (!validForEvent) {
      return NextResponse.json({ error: 'original_path_not_in_event' }, { status: 400 })
    }

    const thumbPath = deriveThumbPath(originalPath, eventSlug)

    // 1) borrar registros de caras
    const { error: facesError, count: facesCount } = await supabase
      .from('event_faces')
      .delete({ count: 'exact' })
      .eq('event_slug', eventSlug)
      .eq('image_url', originalPath)

    if (facesError) {
      console.error('DELETE PHOTO faces error:', facesError)
      return NextResponse.json({ error: 'failed_delete_faces' }, { status: 500 })
    }

    // 2) borrar marca de indexación (permite reindexar si se re-sube)
    const { error: indexedError, count: indexedCount } = await supabase
      .from('event_indexed_files')
      .delete({ count: 'exact' })
      .eq('event_slug', eventSlug)
      .eq('image_url', originalPath)

    if (indexedError) {
      console.error('DELETE PHOTO indexed error:', indexedError)
      return NextResponse.json({ error: 'failed_delete_indexed_file' }, { status: 500 })
    }

    // 3) borrar original en storage privado
    const { error: originalRemoveError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([originalPath])

    if (originalRemoveError) {
      console.error('DELETE PHOTO original storage error:', originalRemoveError)
      return NextResponse.json({ error: 'failed_delete_original' }, { status: 500 })
    }

    // 4) borrar thumb público (si existe)
    if (thumbPath) {
      const { error: thumbRemoveError } = await supabase.storage
        .from(PREVIEW_BUCKET)
        .remove([thumbPath])

      // No reventamos si falla el thumb; devolvemos warning
      if (thumbRemoveError) {
        console.warn('DELETE PHOTO thumb remove warning:', thumbRemoveError)
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        originalPath,
        thumbPath: thumbPath || null,
        faces: facesCount ?? 0,
        indexed: indexedCount ?? 0,
      },
    })
  } catch (err) {
    console.error('DELETE PHOTO route error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}