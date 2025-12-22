import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'event',
  title: 'Evento',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Fecha',
      type: 'date',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'location',
      title: 'Ciudad',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Descripción',
      type: 'text',
    }),
    defineField({
      name: 'coverImage',
      title: 'Imagen portada',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'photos',
      title: 'Fotos del evento',
      type: 'array',
      of: [{ type: 'image' }],
    }),
  ],
})
