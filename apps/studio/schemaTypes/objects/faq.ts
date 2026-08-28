import { defineField, defineType } from 'sanity';

export const faq = defineType({
  name: 'faq',
  title: 'FAQ',
  type: 'object',
  fields: [
    defineField({ name: 'question', type: 'string', validation: (rule) => rule.required().max(180) }),
    defineField({ name: 'answer', type: 'text', rows: 4, validation: (rule) => rule.required().max(1200) }),
  ],
  preview: { select: { title: 'question', subtitle: 'answer' } },
});
