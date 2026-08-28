import { defineField, defineType } from 'sanity';

export const testimonial = defineType({
  name: 'testimonial',
  title: 'Testimonial',
  type: 'object',
  fields: [
    defineField({ name: 'quote', type: 'text', rows: 4, validation: (rule) => rule.required().max(500) }),
    defineField({ name: 'travellerName', title: 'Traveller display name', type: 'string', validation: (rule) => rule.required().max(80) }),
    defineField({ name: 'travellerContext', title: 'Trip or traveller context', type: 'string', validation: (rule) => rule.max(120) }),
    defineField({ name: 'photo', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'verified', title: 'Verified Detour', type: 'boolean', initialValue: false }),
  ],
  preview: { select: { title: 'travellerName', subtitle: 'quote', media: 'photo' } },
});
