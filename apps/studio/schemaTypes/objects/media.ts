import { defineField, defineType } from 'sanity';

export const media = defineType({
  name: 'media',
  title: 'Editorial media',
  type: 'object',
  fields: [
    defineField({ name: 'image', type: 'image', options: { hotspot: true }, validation: (rule) => rule.required() }),
    defineField({ name: 'alt', title: 'Alternative text', type: 'string', validation: (rule) => rule.required().max(180) }),
    defineField({ name: 'caption', type: 'string', validation: (rule) => rule.max(240) }),
    defineField({ name: 'credit', type: 'string', validation: (rule) => rule.max(120) }),
  ],
  preview: { select: { title: 'alt', subtitle: 'caption', media: 'image' } },
});
