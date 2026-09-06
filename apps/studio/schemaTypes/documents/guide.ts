import { defineArrayMember, defineField, defineType } from 'sanity';

export const guide = defineType({
  name: 'guide',
  title: 'Layover guide',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'trust', title: 'Trust and sources' },
    { name: 'search', title: 'Search and social' },
  ],
  fields: [
    defineField({ name: 'title', type: 'string', group: 'content', validation: (rule) => rule.required().max(120) }),
    defineField({ name: 'slug', type: 'slug', group: 'content', options: { source: 'title', maxLength: 96 }, validation: (rule) => rule.required() }),
    defineField({ name: 'description', type: 'text', rows: 3, group: 'content', validation: (rule) => rule.required().min(80).max(260) }),
    defineField({ name: 'heroMedia', title: 'Hero media', type: 'media', group: 'content' }),
    defineField({
      name: 'body', type: 'array', group: 'content', validation: (rule) => rule.required().min(1),
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            { title: 'Paragraph', value: 'normal' }, { title: 'Heading 2', value: 'h2' },
            { title: 'Heading 3', value: 'h3' }, { title: 'Quote', value: 'blockquote' },
          ],
          marks: { annotations: [{ name: 'link', type: 'object', fields: [{ name: 'href', type: 'string', validation: (rule) => rule.required().custom((value) => !value || (typeof value === 'string' && /^(?:\/(?!\/)|#|https?:\/\/)/i.test(value)) || 'Use a clean internal path, #anchor, or http(s) URL.') }] }] },
        }),
        defineArrayMember({ type: 'image', options: { hotspot: true }, fields: [{ name: 'alt', type: 'string', validation: (rule) => rule.required() }] }),
      ],
    }),
    defineField({ name: 'faqs', title: 'FAQs', type: 'array', of: [{ type: 'faq' }], group: 'content' }),
    defineField({ name: 'testimonials', type: 'array', of: [{ type: 'testimonial' }], group: 'content' }),
    defineField({ name: 'author', type: 'string', group: 'trust', initialValue: 'Detour Mumbai student team', validation: (rule) => rule.required() }),
    defineField({ name: 'reviewer', type: 'string', group: 'trust' }),
    defineField({ name: 'sourceLinks', title: 'Sources', type: 'array', of: [{ type: 'sourceLink' }], group: 'trust' }),
    defineField({ name: 'publishedAt', type: 'datetime', group: 'trust', validation: (rule) => rule.required() }),
    defineField({ name: 'updatedAt', title: 'Content reviewed at', type: 'datetime', group: 'trust', validation: (rule) => rule.required() }),
    defineField({ name: 'featured', type: 'boolean', group: 'content', initialValue: false }),
    defineField({ name: 'seo', type: 'seo', group: 'search' }),
  ],
  orderings: [{ title: 'Recently reviewed', name: 'updatedAtDesc', by: [{ field: 'updatedAt', direction: 'desc' }] }],
  preview: { select: { title: 'title', subtitle: 'slug.current', media: 'heroMedia.image' } },
});
