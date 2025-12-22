import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  DetectFacesCommand,
} from '@aws-sdk/client-rekognition'

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

    return NextResponse.json(response)
  } catch (error) {
    console.error('AWS REKOGNITION ERROR:', error)
    return NextResponse.json(
      { error: 'Face detection failed' },
      { status: 500 }
    )
  }
}
