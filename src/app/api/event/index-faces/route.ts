import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  DetectFacesCommand,
} from '@aws-sdk/client-rekognition'
import { createClient } from '@/lib/supabase-server'

const supabase = createClient()

const client = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

export async function POST(req: Request) {
  try {

    // 🔴 luego seguimos con la foto real
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const bytes = Buffer.from(await file.arrayBuffer())

    const command = new DetectFacesCommand({
      Image: { Bytes: bytes },
      Attributes: [],
    })

    const response = await client.send(command)

    const eventSlug = 'evento-demo'
    const imageUrl = 'https://lhnmkonbpehcysbbwfdf.supabase.co/storage/v1/object/public/event-photos/varias%20personas.jpg'

    if (response.FaceDetails?.length) {
      const rows = response.FaceDetails.map(face => ({
        event_slug: eventSlug,
        image_url: imageUrl,
        bounding_box: face.BoundingBox,
        confidence: face.Confidence,
      }))

      await supabase.from('event_faces').insert(rows)
    }

    return NextResponse.json({
      facesDetected: response.FaceDetails?.length ?? 0,
    })
  } catch (error) {
    console.error('INDEX FACES ERROR:', error)
    return NextResponse.json(
      { error: 'Index faces failed' },
      { status: 500 }
    )
  }
}
