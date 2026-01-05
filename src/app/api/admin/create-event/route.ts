import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient()

    const formData = await req.formData()
    const title = formData.get('title') as string
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
      const buffer = Buffer.from(await image.arrayBuffer())
      const fileName = `events/${Date.now()}-${image.name}`

      const { error } = await supabase.storage
        .from('event-photos')
        .upload(fileName, buffer, {
          contentType: image.type,
        })

      if (error) {
        console.error(error)
      } else {
        imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-photos/${fileName}`
      }
    }

    const { error } = await supabase.from('events').insert({
      name: title,
      slug,
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
