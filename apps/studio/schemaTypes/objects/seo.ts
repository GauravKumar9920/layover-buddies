import { defineField, defineType } from 'sanity';

export const seo = defineType({
  name: 'seo',
  title: 'Search and social',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({ name: 'title', title: 'SEO title', type: 'string', validation: (rule) => rule.max(60).warning('Aim for 50–60 characters.') }),
    defineField({ name: 'description', title: 'Meta description', type: 'text', rows: 3, validation: (rule) => rule.max(165).warning('Aim for 150–160 characters.') }),
    defineField({ name: 'socialTitle', title: 'Social title', type: 'string', validation: (rule) => rule.max(70) }),
    defineField({ name: 'socialDescription', title: 'Social description', type: 'text', rows: 3, validation: (rule) => rule.max(200) }),
    defineField({ name: 'socialImage', title: 'Social image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'noIndex', title: 'Hide from search engines', type: 'boolean', initialValue: false }),
  ],
});
