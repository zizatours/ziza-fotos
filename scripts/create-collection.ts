import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import {
  RekognitionClient,
  CreateCollectionCommand,
} from '@aws-sdk/client-rekognition'

const client = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

async function run() {
  const command = new CreateCollectionCommand({
    CollectionId: 'ziza-fotos',
  })

  const response = await client.send(command)
  console.log('Collection created:', response)
}

run()
