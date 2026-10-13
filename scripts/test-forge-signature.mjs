import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findInstalledTargets } from './patch-unreleased-security.mjs';

const root = resolve(process.argv[2] || '.');
const patchScript = fileURLToPath(new URL('./patch-forge-signature.mjs', import.meta.url));
const installed = findInstalledTargets(root, new Set(['node-forge']));
assert(installed.length > 0, 'No installed node-forge copy was checked');
const runPatch = (installRoot) => spawnSync(process.execPath, [patchScript, installRoot], {
  encoding: 'utf8', timeout: 5000,
});
for (let i = 0; i < 2; i++) {
  const patch = runPatch(root);
  assert.ifError(patch.error);
  assert.equal(patch.status, 0, patch.stderr);
}

// A workspace can contain the only runtime copy while the root has a similarly
// named @types package. Test that discovery uses package identity and that an
// unknown second copy prevents writes to an otherwise patchable installation.
const fixture = mkdtempSync(join(tmpdir(), 'detour-forge-guard-'));
try {
  const workspace = join(fixture, 'apps/mobile');
  const directory = join(workspace, 'node_modules/node-forge');
  const typeDirectory = join(fixture, 'node_modules/@types/node-forge');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(typeDirectory, { recursive: true });
  mkdirSync(join(fixture, 'node_modules/@detour'), { recursive: true });
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: '@detour/mobile' }));
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ private: true, workspaces: ['apps/mobile'] }));
  writeFileSync(join(typeDirectory, 'package.json'), JSON.stringify({ name: '@types/node-forge', version: '1.3.14' }));
  symlinkSync(workspace, join(fixture, 'node_modules/@detour/mobile'), 'dir');
  cpSync(installed[0].directory, directory, { recursive: true });
  writeFileSync(join(fixture, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {
    'apps/mobile/node_modules/node-forge': { version: '1.4.0' },
    'node_modules/@types/node-forge': { version: '1.3.14' },
  } }));
  assert.deepEqual(findInstalledTargets(fixture, new Set(['node-forge'])).map(({ directory: found }) => found), [realpathSync(directory)]);

  const file = join(directory, 'lib/rsa.js');
  const patchedSource = readFileSync(file, 'utf8');
  const guardStart = patchedSource.indexOf('            obj.value.length !== 2 ||\n');
  const guardEndLine = "               obj.value[0].value[1].value !== ''))) {";
  const guardEnd = patchedSource.indexOf(guardEndLine, guardStart);
  assert(guardStart >= 0 && guardEnd > guardStart, 'The fixture must start with the reviewed guard');
  const originalSource = patchedSource.slice(0, guardStart) + '            obj.value.length !== 2) {' + patchedSource.slice(guardEnd + guardEndLine.length);
  writeFileSync(file, originalSource);
  const patch = runPatch(fixture);
  assert.ifError(patch.error);
  assert.equal(patch.status, 0, patch.stderr);
  assert.equal(readFileSync(file, 'utf8'), patchedSource, 'The workspace-only copy must be patched');
  const repeated = runPatch(fixture);
  assert.ifError(repeated.error);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(readFileSync(file, 'utf8'), patchedSource, 'Reapplying the guard must preserve its source');

  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'node-forge', version: '1.4.1' }));
  const unknownVersion = runPatch(fixture);
  assert.ifError(unknownVersion.error);
  assert.notEqual(unknownVersion.status, 0);
  assert.match(unknownVersion.stderr, /Review node-forge 1\.4\.1/);
  writeFileSync(join(directory, 'package.json'), readFileSync(join(installed[0].directory, 'package.json')));

  const unknown = join(fixture, 'node_modules/node-forge');
  cpSync(installed[0].directory, unknown, { recursive: true });
  writeFileSync(join(unknown, 'lib/rsa.js'), patchedSource + '\n// unrecognized source\n');
  writeFileSync(file, originalSource);
  const rejected = runPatch(fixture);
  assert.ifError(rejected.error);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Unexpected node-forge source/);
  assert.equal(readFileSync(file, 'utf8'), originalSource, 'An unknown copy must prevent partial patch writes');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

for (const { directory } of installed) {
  const require = createRequire(resolve(root, 'package.json'));
  const forge = require(directory);
  const { publicKey, privateKey } = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const md = forge.md.sha256.create().update('detour signature regression');
  const digest = md.digest().getBytes();
  assert.equal(publicKey.verify(digest, privateKey.sign(md)), true);
  assert.equal(publicKey.verify(forge.md.sha256.create().update('tampered').digest().getBytes(), privateKey.sign(md)), false);
  const a = forge.asn1;
  const oid = () => a.create(a.Class.UNIVERSAL, a.Type.OID, false, a.oidToDer(forge.oids.sha256).getBytes());
  const nil = () => a.create(a.Class.UNIVERSAL, a.Type.NULL, false, '');
  const octet = () => a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, 'garbage');
  function signature(fields) {
    const obj = a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, [
      a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, fields),
      a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, digest),
    ]);
    return privateKey.sign(a.toDer(obj).getBytes(), 'NONE');
  }
  assert.equal(publicKey.verify(digest, signature([oid()])), true);
  assert.equal(publicKey.verify(digest, signature([oid(), nil()])), true);
  for (const fields of [
    [oid(), nil(), octet()], [oid(), octet()],
    [oid(), a.create(a.Class.UNIVERSAL, a.Type.NULL, false, 'garbage')],
  ]) {
    assert.throws(() => publicKey.verify(digest, signature(fields)), /DigestInfo/);
  }
}
console.log(`RSA signature guard verified for ${installed.length} installed copies.`);
