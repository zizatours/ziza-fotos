import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Guardamos cover en bucket público
const BUCKET = 'event-previews'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const { event_slug, adminKey, content_type } = body as {
      event_slug?: string
      adminKey?: string
      content_type?: string
    }

    // 🔒 auth
    const expected = process.env.ADMIN_PASSWORD
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const slug = (event_slug || '').trim()
    if (!slug) {
      return NextResponse.json({ error: 'missing_event_slug' }, { status: 400 })
    }

    // Queremos cover.webp
    const path = `eventos/${slug}/cover/cover.webp`
    const contentType = (content_type || 'image/webp').toString()

    const supabase = createAdminClient()

    // Supabase signed upload
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path)

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: 'signed_url_failed', details: error?.message || 'no signedUrl' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const publicUrl = baseUrl
      ? `${baseUrl}/storage/v1/object/public/${BUCKET}/${path}`
      : null

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      path,
      contentType,
      signedUrl: data.signedUrl,
      publicUrl,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'server_error', details: String(e?.message || e) },
      { status: 500 }
    )
  }
}
