import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(app, '../..');
const places = JSON.parse(await readFile(path.join(app, 'src/data/place-guides.json'), 'utf8'));
await mkdir(path.join(app, 'public/images/places'), { recursive: true });
const cityPhotos = JSON.parse(await readFile(path.join(app, 'src/data/city-photos.json'), 'utf8'));
for (const photo of [...places.flatMap(place => place.photos), ...cityPhotos]) {
  const source = path.join(repo, photo.source);
  for (const [url, width] of [[photo.src, 1600], [photo.thumb, 480]]) {
    await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(app, 'public', url));
  }
}
console.log(`Prepared ${places.reduce((n, p) => n + p.photos.length, 0)} place photographs and ${cityPhotos.length} city photographs in two sizes; originals unchanged.`);
