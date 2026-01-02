import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const supabase = createAdminClient()

export async function GET() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('LIST EVENTS ERROR:', error)
    return NextResponse.json({ events: [] })
  }

  return NextResponse.json({ events: data })
}
