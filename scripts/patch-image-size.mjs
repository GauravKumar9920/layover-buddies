import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('image-size/package.json');
const packageRoot = dirname(packageJsonPath);
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

if (packageJson.version !== '1.2.1') {
  throw new Error(
    `Refusing to patch unexpected image-size version ${packageJson.version}. ` +
      'Review the upstream package before changing this guard.',
  );
}

async function applyExactPatch(relativePath, vulnerableSource, patchedSource) {
  const targetPath = join(packageRoot, relativePath);
  const source = await readFile(targetPath, 'utf8');

  if (source.includes(patchedSource)) return;
  if (!source.includes(vulnerableSource)) {
    throw new Error(`Expected vulnerable source was not found in ${targetPath}`);
  }

  await writeFile(targetPath, source.replace(vulnerableSource, patchedSource));
}

await applyExactPatch(
  'dist/types/utils.js',
  `    const boxSize = (0, exports.readUInt32BE)(input, offset);\n    if (input.length - offset < boxSize)\n        return;`,
  `    const boxSize = (0, exports.readUInt32BE)(input, offset);\n    // ISO BMFF boxes require an 8-byte header. Reject zero/undersized boxes\n    // so callers can never re-enter their scan loop at the same offset.\n    if (boxSize < 8 || input.length - offset < boxSize)\n        return;`,
);

await applyExactPatch(
  'dist/types/icns.js',
  `    return [\n        (0, utils_1.toUTF8String)(input, imageOffset, imageLengthOffset),\n        (0, utils_1.readUInt32BE)(input, imageLengthOffset),\n    ];`,
  `    const imageLength = (0, utils_1.readUInt32BE)(input, imageLengthOffset);\n    // Every ICNS entry includes an 8-byte type/length header. A zero or\n    // undersized length would otherwise leave imageOffset unchanged forever.\n    if (imageLength < 8)\n        throw new TypeError('Invalid ICNS entry length');\n    return [\n        (0, utils_1.toUTF8String)(input, imageOffset, imageLengthOffset),\n        imageLength,\n    ];`,
);
