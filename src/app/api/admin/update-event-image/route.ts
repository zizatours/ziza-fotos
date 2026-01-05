import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient()

    const formData = await req.formData()
    const eventSlug = formData.get('eventSlug') as string
    const image = formData.get('image') as File | null

    if (!eventSlug || !image) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    // Subir imagen a Supabase Storage
    const buffer = Buffer.from(await image.arrayBuffer())
    const fileName = `events/${eventSlug}-${Date.now()}-${image.name}`

    const { error: uploadError } = await supabase.storage
      .from('event-photos')
      .upload(fileName, buffer, {
        contentType: image.type,
      })

    if (uploadError) {
      console.error(uploadError)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-photos/${fileName}`

    // Actualizar evento por slug
    const { error: updateError } = await supabase
      .from('events')
      .update({ image_url: imageUrl })
      .eq('slug', eventSlug)

    if (updateError) {
      console.error(updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}
