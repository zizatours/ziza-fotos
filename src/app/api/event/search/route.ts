import { NextResponse } from 'next/server'
import { RekognitionClient, DetectFacesCommand, CompareFacesCommand } from '@aws-sdk/client-rekognition'
import { createPublicClient } from '@/lib/supabase-server'

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const eventSlug = formData.get('event_slug') as string

    if (!file || !eventSlug) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // 1️⃣ Detectar rostro en la selfie
    const detectRes = await rekognition.send(
      new DetectFacesCommand({
        Image: { Bytes: buffer },
      })
    )

    if (!detectRes.FaceDetails?.length) {
      return NextResponse.json({ matches: [] })
    }

    // 2️⃣ Obtener caras del evento desde Supabase
    const supabase = createPublicClient()

    const { data: faces } = await supabase
      .from('event_faces')
      .select('image_url, face_id')
      .eq('event_slug', eventSlug)

    if (!faces || faces.length === 0) {
      return NextResponse.json({ matches: [] })
    }

    const matches: any[] = []

    // 3️⃣ Comparar la selfie contra cada cara del evento
    for (const face of faces) {
      const compareRes = await rekognition.send(
        new CompareFacesCommand({
          SourceImage: { Bytes: buffer },
          TargetImage: {
            S3Object: {
              Bucket: process.env.AWS_BUCKET_NAME!,
              Name: face.image_url.split('/').pop()!,
            },
          },
          SimilarityThreshold: 90,
        })
      )

      if (compareRes.FaceMatches?.length) {
        matches.push({
          image_url: face.image_url,
          similarity: compareRes.FaceMatches[0].Similarity,
        })
      }
    }

    return NextResponse.json({ matches })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Error buscando fotos' },
      { status: 500 }
    )
  }
}
