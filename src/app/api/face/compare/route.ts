import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  CompareFacesCommand,
} from '@aws-sdk/client-rekognition'
import { createAdminClient } from '@/lib/supabase-server'

const supabase = createAdminClient()

const client = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No selfie provided' },
        { status: 400 }
      )
    }

    // 1️⃣ Convertir selfie a bytes
    const selfieBytes = Buffer.from(await file.arrayBuffer())

    // 2️⃣ Traer caras del evento (por ahora hardcode)
    const eventSlug = 'evento-demo'

    const { data: faces, error } = await supabase
      .from('event_faces')
      .select('*')
      .eq('event_slug', eventSlug)

    if (error || !faces?.length) {
      return NextResponse.json({ matches: [] })
    }

    const matches: any[] = []

    // 3️⃣ Comparar selfie vs cada cara guardada
    for (const face of faces) {
      if (!face.image_url) continue // por ahora

      const imageRes = await fetch(face.image_url)
      const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

      const command = new CompareFacesCommand({
        SourceImage: { Bytes: selfieBytes },
        TargetImage: { Bytes: imageBuffer },
        SimilarityThreshold: 90,
      })

      const response = await client.send(command)

      if (response.FaceMatches?.length) {
        matches.push({
          image_url: face.image_url,
          similarity: response.FaceMatches[0].Similarity,
        })
      }
    }

    return NextResponse.json({ matches })
  } catch (error) {
    console.error('COMPARE ERROR:', error)
    return NextResponse.json(
      { error: 'Compare failed' },
      { status: 500 }
    )
  }
}
