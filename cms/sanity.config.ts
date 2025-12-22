import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import event from './schemaTypes/event'

export default defineConfig({
  name: 'default',
  title: 'zizatours',

  projectId: 't2qvzdji',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  schema: {
    types: [event],
  },
})
