import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { findInstalledTargets } from './patch-unreleased-security.mjs';

// GHSA-86w9-cpqp-85rv has no published fix. Preserve the upstream API and
// reject surplus/malformed DigestAlgorithm fields before trusting a signature.
const originalHash = 'fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50';
const before = '            obj.value.length !== 2) {';
const after = `            obj.value.length !== 2 ||
            // Detour: strictly validate the nested DigestAlgorithm sequence.
            !Array.isArray(obj.value[0].value) ||
            (obj.value[0].value.length !== 1 && obj.value[0].value.length !== 2) ||
            (obj.value[0].value.length === 2 &&
              (obj.value[0].value[1].tagClass !== asn1.Class.UNIVERSAL ||
               obj.value[0].value[1].type !== asn1.Type.NULL ||
               obj.value[0].value[1].constructed ||
               obj.value[0].value[1].value !== ''))) {`;

const writes = [];
for (const { directory, version } of findInstalledTargets(resolve(process.argv[2] || '.'), new Set(['node-forge']))) {
  if (version !== '1.4.0') throw new Error(`Review node-forge ${version} before changing its signature guard`);
  const file = join(directory, 'lib/rsa.js');
  const source = await readFile(file, 'utf8');
  const unpatched = source.includes(after) ? source.replace(after, before) : source;
  if (createHash('sha256').update(unpatched).digest('hex') !== originalHash) {
    throw new Error(`Unexpected node-forge source: ${file}`);
  }
  if (!source.includes(after)) writes.push([file, source.replace(before, after)]);
}
// Fail before changing any copies when one installation is unrecognized.
for (const [file, source] of writes) await writeFile(file, source);
