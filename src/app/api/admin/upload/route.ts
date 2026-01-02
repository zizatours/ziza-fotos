import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  const eventSlug = formData.get('event_slug') as string

  if (!eventSlug) {
    return Response.json(
      { error: 'Missing event_slug' },
      { status: 400 }
    )
  }


  if (!file) {
    return NextResponse.json({ error: 'No file' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  const filePath = `${eventSlug}/${file.name}`

  const { error } = await supabase.storage
    .from('event-photos')
    .upload(filePath, bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    if (error.message.includes('The resource already exists')) {
      return NextResponse.json(
        { error: 'La foto ya existe en este evento' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Error subiendo foto' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
