import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL || "https://zizaphotography.com.br"

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    // Ideal: ANON si tu tabla events es pública. Si no, usa SERVICE_ROLE (server-only).
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: events } = await supabase
    .from("events")
    .select("slug, created_at")
    .order("created_at", { ascending: false })

  const eventUrls =
    (events ?? [])
      .filter((e) => e.slug)
      .map((e) => ({
        url: `${siteUrl}/evento/${e.slug}`,
        lastModified: e.created_at ? new Date(e.created_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...eventUrls,
  ]
}
