export const runtime = "nodejs";

import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  SearchFacesByImageCommand,
} from '@aws-sdk/client-rekognition'
import { createClient } from '@supabase/supabase-js'

const rekognition = new RekognitionClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function extractEventPhotoPath(imageUrlOrPath: string) {
  if (!imageUrlOrPath) return ''

  // Si ya viene como path ("evento/archivo.jpg"), lo devolvemos limpio
  if (!/^https?:\/\//i.test(imageUrlOrPath)) {
    return imageUrlOrPath.replace(/^\/+/, '')
  }

  // Si viene como URL completa, extraemos el path dentro del bucket
  try {
    const url = new URL(imageUrlOrPath)
    const prefix = '/storage/v1/object/public/event-photos/'
    const pathname = url.pathname

    if (pathname.includes(prefix)) {
      return pathname.replace(prefix, '').replace(/^\/+/, '')
    }

    // fallback: devolvemos el pathname sin slash inicial
    return pathname.replace(/^\/+/, '')
  } catch {
    // fallback extremo: si algo raro viene, no reventamos
    return imageUrlOrPath.replace(/^\/+/, '')
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const event_slug_raw = formData.get('event_slug')
    const selfieFile = formData.get('selfie')

    if (
      typeof event_slug_raw !== 'string' ||
      !(selfieFile instanceof File)
    ) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      )
    }

    const event_slug = event_slug_raw.trim().toLowerCase()

    const selfieBuffer = Buffer.from(
      await selfieFile.arrayBuffer()
    )

    // 🔍 BUSCAR EN LA COLECCIÓN
    const searchCommand = new SearchFacesByImageCommand({
      CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
      Image: { Bytes: selfieBuffer },
      FaceMatchThreshold: 65, // ⬅️ CLAVE
      MaxFaces: 50,
    })

    const searchResult = await rekognition.send(searchCommand)

    console.log(
      '🔍 SEARCH COLLECTION:',
      process.env.AWS_REKOGNITION_COLLECTION_ID
    )

    console.log(
      '🔍 FACE MATCHES RAW:',
      searchResult.FaceMatches?.map(m => ({
        faceId: m.Face?.FaceId,
        similarity: m.Similarity,
      }))
    )

    const matchedFaceIds =
      searchResult.FaceMatches
        ?.map(m => m.Face?.FaceId)
        .filter(Boolean) ?? []

    console.log('🔍 MATCHED FACE IDS:', matchedFaceIds)

    if (matchedFaceIds.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // 🗄️ CRUZAR CON SUPABASE
    const { data: photos, error } = await supabase
      .from('event_faces')
      .select('image_url')
      .eq('event_slug', event_slug)
      .in('face_id', matchedFaceIds)

    console.log('🖼️ PHOTOS FROM DB:', photos)

    if (error) {
      console.error('SUPABASE ERROR:', error)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      results:
        photos
          ?.map(p => extractEventPhotoPath(p.image_url))
          .filter(Boolean) ?? [],
    })

  } catch (err) {
    console.error('SEARCH ERROR:', err)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
