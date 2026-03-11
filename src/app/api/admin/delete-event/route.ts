import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const supabase = createAdminClient()

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  const event_slug = body?.event_slug
  const gotKey = req.headers.get('x-admin-key') || body?.adminKey

  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY
  if (expected && (!gotKey || gotKey !== expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!event_slug) {
    return NextResponse.json(
      { error: 'Missing event_slug' },
      { status: 400 }
    )
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null

  const ua = req.headers.get('user-agent') || null

  await supabase.from('admin_audit_log').insert({
    action: 'delete_event',
    event_slug,
    target_path: null,
    ip,
    user_agent: ua,
  })

  // 1️⃣ borrar caras del evento
  const { error: facesError } = await supabase
    .from('event_faces')
    .delete()
    .eq('event_slug', event_slug)

  if (facesError) {
    console.error('Delete faces error:', facesError)
    return NextResponse.json(
      { error: 'Failed to delete event faces' },
      { status: 500 }
    )
  }

  // 2️⃣ borrar fotos del storage
  const { data: files, error: listError } = await supabase.storage
    .from('event-photos')
    .list(event_slug)

  if (listError) {
    console.error('List storage error:', listError)
    return NextResponse.json(
      { error: 'Failed to list event photos' },
      { status: 500 }
    )
  }

  if (files && files.length > 0) {
    const paths = files.map((f) => `${event_slug}/${f.name}`)

    const { error: removeError } = await supabase.storage
      .from('event-photos')
      .remove(paths)

    if (removeError) {
      console.error('Remove storage error:', removeError)
      return NextResponse.json(
        { error: 'Failed to remove event photos' },
        { status: 500 }
      )
    }
  }

  // 3️⃣ borrar evento
  const { error: eventError } = await supabase
    .from('events')
    .delete()
    .eq('slug', event_slug)

  if (eventError) {
    console.error('Delete event error:', eventError)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
