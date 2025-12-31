import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(req: Request) {
  const { title } = await req.json()

  if (!title) {
    return NextResponse.json(
      { error: 'Title required' },
      { status: 400 }
    )
  }

  const slug = slugify(title)

  const { error } = await supabase.from('events').insert({
    name: title,
    slug,
    date: null,
    location: '',
    image_url: '',
  })

  if (error) {
    console.error('SUPABASE ERROR:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, slug })
}
