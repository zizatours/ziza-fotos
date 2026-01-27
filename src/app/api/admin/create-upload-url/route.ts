import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const BUCKET = 'event-photos'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { event_slug, file_name, content_type, adminKey } = body as {
      event_slug?: string
      file_name?: string
      content_type?: string
      adminKey?: string
    }

    // 👇 Si ya tienes otro sistema de auth admin, puedes adaptar esto.
    // Por ahora: valida contra una env (misma clave que usas en /api/admin/login)
    const expected = process.env.ADMIN_PASSWORD
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (!event_slug || !file_name) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'missing_env' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const path = `${event_slug}/${file_name}`

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false })

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: 'signed_url_failed', details: error?.message || 'unknown' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      path: data.path,
      signedUrl: data.signedUrl,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', details: String(e?.message || e) }, { status: 500 })
  }
}
