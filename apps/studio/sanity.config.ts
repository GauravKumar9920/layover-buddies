import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemaTypes';
import { detourStructure } from './structure';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || '';
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';
const previewOrigin = (process.env.SANITY_STUDIO_PREVIEW_ORIGIN || 'http://127.0.0.1:8791').replace(/\/$/, '');

export default defineConfig({
  name: 'detour-content',
  title: 'Detour Content',
  projectId,
  dataset,
  plugins: [structureTool({ structure: detourStructure }), visionTool()],
  schema: { types: schemaTypes },
  document: {
    productionUrl: async (previousUrl, context) => {
      const document = context.document as { _type?: string; slug?: { current?: string }; path?: string };
      if (document._type === 'guide' && document.slug?.current) {
        return `${previewOrigin}/guides/${document.slug.current}`;
      }
      if (document._type === 'landingPage' && document.path) {
        const route = document.path.startsWith('/') ? document.path : `/${document.path}`;
        return `${previewOrigin}${route}`;
      }
      return previousUrl;
    },
  },
});
