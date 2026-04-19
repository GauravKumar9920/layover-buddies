# Website - Marketing & Landing Pages

## Purpose
This folder contains the static marketing website built with Vite and Tailwind CSS. Currently, it serves as the public-facing marketing platform for Mumbai Buddies, showcasing the platform, features, and calls-to-action for travelers and guides.

## Current Setup
- **Build Tool**: Vite (for fast development and optimized builds)
- **Styling**: Tailwind CSS (utility-first framework)
- **Pages**: index.html (home), know-more.html (about/features)
- **Assets**: Static images, icons, fonts in `/public`

## Tech Stack
- Vite
- Tailwind CSS
- PostCSS
- JavaScript (vanilla or minimal framework usage)

## Quick Start
```bash
npm install
npm run dev
```

## Build for Production
```bash
npm run build
```

## Future Migration Note
Existing files at the root level (index.html, know-more.html, src/, public/, dist/, vite.config.js, etc.) should eventually be reorganized into this website folder to keep the project root clean. For now, they remain at the project root to maintain functionality.

## SEO & Meta
- Update meta tags in HTML files for proper SEO
- Configure social media preview cards (OG tags)
- Ensure mobile responsiveness with Tailwind utilities

## Deployment
Website is currently deployed to `/dist` folder via `npm run build`. Configure hosting (Vercel, Netlify, or custom server) as needed.
