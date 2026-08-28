import { defineField, defineType } from 'sanity';

export const sourceLink = defineType({
  name: 'sourceLink',
  title: 'Source link',
  type: 'object',
  fields: [
    defineField({ name: 'label', type: 'string', validation: (rule) => rule.required().max(120) }),
    defineField({ name: 'url', type: 'url', validation: (rule) => rule.required().uri({ scheme: ['http', 'https'] }) }),
    defineField({ name: 'checkedAt', title: 'Last checked', type: 'date' }),
  ],
  preview: { select: { title: 'label', subtitle: 'url' } },
});
