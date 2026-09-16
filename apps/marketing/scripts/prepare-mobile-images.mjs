import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const repo = new URL('../../', root);
const photos = JSON.parse(await readFile(new URL('src/data/city-photos.json', root)));
await mkdir(new URL('public/images/mobile/', root), { recursive: true });
for (const width of [480, 800]) {
  await sharp(new URL(photos[3].source, repo).pathname).rotate()
    .resize({ width, height: Math.round(width * 1.42), fit: 'cover', position: 'centre' })
    .webp({ quality: 78 }).toFile(new URL(`public/images/mobile/mumbai-night-${width}.webp`, root).pathname);
}
console.log('Prepared two portrait mobile hero sizes from Vikram SN’s supplied skyline photograph.');
