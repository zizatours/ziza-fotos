import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculatePhotoPrice } from '@/lib/calculatePhotoPrice'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json()
  const { event_slug, images, email } = body

  if (!event_slug || !images?.length || !email) {
    return NextResponse.json(
      { error: 'Missing data' },
      { status: 400 }
    )
  }

  const pricing = calculatePhotoPrice(images.length)

  const { data, error } = await supabase
    .from('orders')
    .insert({
      event_slug,
      email,
      status: 'pending',
      selected_images: images,
      total_amount: pricing.total,
      currency: 'BRL',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    order_id: data.id,
    pricing,
  })
}
