import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
  schema: z.object({
    route: z.string().startsWith('/'),
    legacySource: z.string(),
    pageType: z.enum(['home', 'collection', 'article', 'website', 'error']),
    title: z.string(),
    description: z.string(),
    socialTitle: z.string().optional(),
    socialDescription: z.string().optional(),
    image: z.string().default('/images/hero-skyline-main.jpg'),
    publishedAt: z.string().optional(),
    updatedAt: z.string(),
    changeFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
    priority: z.number().min(0).max(1).default(0.5),
    index: z.boolean().default(true),
    author: z.string().default('Detour Mumbai student team'),
    reviewer: z.string().optional(),
  }),
});

export const collections = { pages };
