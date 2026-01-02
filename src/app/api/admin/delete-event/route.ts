import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { event_slug } = await req.json()

  if (!event_slug) {
    return NextResponse.json(
      { error: 'Missing event_slug' },
      { status: 400 }
    )
  }

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
