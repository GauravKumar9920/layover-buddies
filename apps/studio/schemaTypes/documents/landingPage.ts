import { defineArrayMember, defineField, defineType } from 'sanity';

const CODE_CONTROLLED_PATHS = new Set(['/privacy', '/terms']);

function isEditablePath(value: unknown) {
  if (typeof value !== 'string') return true;
  const normalized = value.length > 1 ? value.replace(/\/+$/, '') : value;
  return CODE_CONTROLLED_PATHS.has(normalized)
    ? `${normalized} is code-controlled and cannot be edited in Sanity.`
    : true;
}

export const landingPage = defineType({
  name: 'landingPage',
  title: 'Landing page',
  type: 'document',
  groups: [{ name: 'content', title: 'Content', default: true }, { name: 'search', title: 'Search and social' }],
  fields: [
    defineField({ name: 'title', type: 'string', group: 'content', validation: (rule) => rule.required().max(120) }),
    defineField({ name: 'path', title: 'Clean URL path', type: 'string', group: 'content', description: 'For example / or /mumbai-layover-tour. Privacy and terms remain code-controlled.', validation: (rule) => rule.required().regex(/^\/[a-z0-9/_-]*$/).custom(isEditablePath) }),
    defineField({ name: 'description', type: 'text', rows: 3, group: 'content', validation: (rule) => rule.required().max(260) }),
    defineField({ name: 'eyebrow', type: 'string', group: 'content', validation: (rule) => rule.max(80) }),
    defineField({ name: 'heroMedia', title: 'Hero media', type: 'media', group: 'content' }),
    defineField({ name: 'cta', title: 'Call to action', type: 'object', group: 'content', fields: [
      { name: 'label', type: 'string', validation: (rule) => rule.required().max(60) },
      { name: 'destination', type: 'string', description: 'A Detour path, #booking, or an https URL.', validation: (rule) => rule.required().max(300).custom((value) => !value || (typeof value === 'string' && /^(?:\/(?!\/)|#|https:\/\/)/i.test(value)) || 'Use a clean internal path, #anchor, or https URL.') },
    ] }),
    defineField({
      name: 'body', type: 'array', group: 'content', validation: (rule) => rule.required().min(1), of: [
        defineArrayMember({
          type: 'block',
          styles: [{ title: 'Paragraph', value: 'normal' }, { title: 'Heading 2', value: 'h2' }, { title: 'Heading 3', value: 'h3' }],
          marks: { annotations: [{ name: 'link', type: 'object', fields: [{ name: 'href', type: 'string', validation: (rule) => rule.required().custom((value) => !value || (typeof value === 'string' && /^(?:\/(?!\/)|#|https?:\/\/)/i.test(value)) || 'Use a clean internal path, #anchor, or http(s) URL.') }] }] },
        }),
        defineArrayMember({ type: 'image', options: { hotspot: true }, fields: [{ name: 'alt', type: 'string', validation: (rule) => rule.required() }] }),
      ],
    }),
    defineField({ name: 'faqs', type: 'array', of: [{ type: 'faq' }], group: 'content' }),
    defineField({ name: 'testimonials', type: 'array', of: [{ type: 'testimonial' }], group: 'content' }),
    defineField({ name: 'founderNote', title: 'Founder note', type: 'text', rows: 5, group: 'content' }),
    defineField({ name: 'author', type: 'string', group: 'content', initialValue: 'Detour Mumbai student team' }),
    defineField({ name: 'reviewer', type: 'string', group: 'content' }),
    defineField({ name: 'sourceLinks', title: 'Sources', type: 'array', of: [{ type: 'sourceLink' }], group: 'content' }),
    defineField({ name: 'publishedAt', type: 'datetime', group: 'content' }),
    defineField({ name: 'featuredContent', type: 'array', of: [{ type: 'reference', to: [{ type: 'guide' }] }], group: 'content' }),
    defineField({ name: 'updatedAt', title: 'Content reviewed at', type: 'datetime', group: 'content', validation: (rule) => rule.required() }),
    defineField({ name: 'seo', type: 'seo', group: 'search' }),
  ],
  preview: { select: { title: 'title', subtitle: 'path', media: 'heroMedia.image' } },
});
