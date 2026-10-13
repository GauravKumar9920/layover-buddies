import { defineArrayMember, defineField, defineType } from 'sanity';

const discoveryGroups: Record<string, string[]> = {
  explore: ['browse-all', 'self-guided-walks', 'food-and-culture', 'close-to-the-airport', 'central-mumbai', 'south-mumbai', 'further-afield'],
  plan: ['start-here', 'by-time', 'airport-essentials', 'practical-travel', 'conditions-and-preparation', 'pace-and-needs', 'resources'],
  detour: ['how-it-works', 'plans-changing', 'careers'],
};

/** Shared by guides and landing pages, so publishing has one discovery vocabulary. */
export function discoveryField() {
  return defineField({
    name: 'discovery', title: 'Website organisation', type: 'object', group: 'discovery',
    description: 'Every published page needs one primary home. The website uses this for collections, breadcrumbs, related links and search.',
    validation: (rule) => rule.required(),
    fields: [
      defineField({ name: 'section', title: 'Primary section', type: 'string', initialValue: 'plan', options: { list: [
        { title: 'Explore Mumbai', value: 'explore' }, { title: 'Plan your layover', value: 'plan' }, { title: 'How Detour works', value: 'detour' },
      ] }, validation: (rule) => rule.required() }),
      defineField({ name: 'group', title: 'Content group', type: 'string', initialValue: 'start-here', options: { list: [
        { title: 'Explore · All places', value: 'browse-all' }, { title: 'Explore · Self-guided walks', value: 'self-guided-walks' },
        { title: 'Explore · Food and culture', value: 'food-and-culture' }, { title: 'Explore · Close to the airport', value: 'close-to-the-airport' },
        { title: 'Explore · Central Mumbai', value: 'central-mumbai' }, { title: 'Explore · South Mumbai', value: 'south-mumbai' }, { title: 'Explore · Further afield', value: 'further-afield' },
        { title: 'Plan · Start here', value: 'start-here' }, { title: 'Plan · Plans by duration', value: 'by-time' },
        { title: 'Plan · Airport essentials', value: 'airport-essentials' }, { title: 'Plan · Practical travel', value: 'practical-travel' },
        { title: 'Plan · Weather and preparation', value: 'conditions-and-preparation' }, { title: 'Plan · Your pace and needs', value: 'pace-and-needs' }, { title: 'Plan · Resources', value: 'resources' },
        { title: 'Detour · The experience', value: 'how-it-works' }, { title: 'Detour · When plans change', value: 'plans-changing' }, { title: 'Detour · Careers', value: 'careers' },
      ] }, validation: (rule) => rule.required().custom((value, context) => {
        const section = (context.parent as { section?: string })?.section;
        return !section || !value || discoveryGroups[section]?.includes(value) || 'Choose a group belonging to the selected primary section.';
      }) }),
      defineField({ name: 'kind', title: 'Content kind', type: 'string', initialValue: 'guide', options: { list: [
        { title: 'Guide or service answer', value: 'guide' }, { title: 'Collection hub', value: 'hub' }, { title: 'Company page', value: 'company' },
      ] } }),
      defineField({ name: 'navigationTitle', title: 'Short link title', type: 'string', description: 'A readable title for cards and menus, without an SEO suffix.', validation: (rule) => rule.required().max(100) }),
      defineField({ name: 'parentRoute', title: 'Primary parent path', type: 'string', initialValue: '/guides', description: 'Usually /guides/places, /guides, or /guides/what-to-expect-on-a-detour.', validation: (rule) => rule.required().regex(/^\/[a-z0-9/_.-]*$/) }),
      defineField({ name: 'tags', title: 'Topics', type: 'array', of: [defineArrayMember({ type: 'string' })], options: { layout: 'tags' }, validation: (rule) => rule.max(30) }),
      defineField({ name: 'aliases', title: 'Search aliases', type: 'array', of: [defineArrayMember({ type: 'string' })], options: { layout: 'tags' }, description: 'Verified alternative names or common questions, such as CSMT / VT or bags / luggage.', validation: (rule) => rule.max(30) }),
      defineField({ name: 'relatedRoutes', title: 'Related page paths', type: 'array', of: [defineArrayMember({ type: 'string', validation: (rule) => rule.regex(/^\/[a-z0-9/_.-]*$/) })], description: 'Published internal paths only. The website removes unresolved references.', validation: (rule) => rule.max(8) }),
      defineField({ name: 'searchable', title: 'Include in website search and collections', type: 'boolean', initialValue: true }),
    ],
  });
}

export const guide = defineType({
  name: 'guide',
  title: 'Layover guide',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'trust', title: 'Trust and sources' },
    { name: 'search', title: 'Search and social' },
    { name: 'discovery', title: 'Website organisation' },
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
    defineField({ name: 'author', type: 'string', group: 'trust', initialValue: 'Detour founder team', validation: (rule) => rule.required() }),
    defineField({ name: 'reviewer', type: 'string', group: 'trust' }),
    defineField({ name: 'sourceLinks', title: 'Sources', type: 'array', of: [{ type: 'sourceLink' }], group: 'trust' }),
    defineField({ name: 'publishedAt', type: 'datetime', group: 'trust', validation: (rule) => rule.required() }),
    defineField({ name: 'updatedAt', title: 'Content reviewed at', type: 'datetime', group: 'trust', validation: (rule) => rule.required() }),
    defineField({ name: 'featured', type: 'boolean', group: 'content', initialValue: false }),
    defineField({ name: 'seo', type: 'seo', group: 'search' }),
    discoveryField(),
  ],
  orderings: [{ title: 'Recently reviewed', name: 'updatedAtDesc', by: [{ field: 'updatedAt', direction: 'desc' }] }],
  preview: { select: { title: 'title', subtitle: 'slug.current', media: 'heroMedia.image' } },
});
