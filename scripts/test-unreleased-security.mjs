import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { findInstalledTargets, patchUnreleasedSecurity } from './patch-unreleased-security.mjs';

const root = path.resolve(process.argv[2] || process.cwd());
const installed = findInstalledTargets(root);
assert(installed.some(({ name }) => name === 'braces'), 'No installed braces copy was checked');
assert(installed.some(({ name }) => name === 'sprintf-js'), 'No installed sprintf-js copy was checked');

const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const sources = installed.flatMap(({ directory, name }) => name === 'braces'
  ? ['lib/parse.js', 'lib/compile.js', 'lib/expand.js', 'lib/stringify.js', 'lib/detour-depth-guard.js'].map((file) => path.join(directory, file))
  : ['src/sprintf.js', 'dist/sprintf.min.js'].map((file) => path.join(directory, file)));
const before = sources.map(digest);
patchUnreleasedSecurity(root);
assert.deepEqual(sources.map(digest), before, 'Security patches must be idempotent');

// Test nested-copy discovery and fail-closed behavior without touching the
// installation under test. The fixture contains only the files we patch.
const fixture = mkdtempSync(path.join(tmpdir(), 'detour-security-guards-'));
try {
  const packages = {};
  const copyTarget = (target, relative) => {
    const directory = path.join(fixture, relative);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: target.name, version: target.version }));
    for (const file of sources.filter((file) => file.startsWith(target.directory + path.sep))) {
      const destination = path.join(directory, path.relative(target.directory, file));
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(file, destination);
    }
    packages[relative] = { version: target.version };
    return directory;
  };
  const braces = installed.find(({ name }) => name === 'braces');
  const sprintf = installed.find(({ name }) => name === 'sprintf-js');
  const braceDirectory = copyTarget(braces, 'node_modules/braces');
  copyTarget(sprintf, 'node_modules/sprintf-js');
  const consumer = path.join(fixture, 'node_modules/@detour/fixture-consumer');
  mkdirSync(consumer, { recursive: true });
  writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: '@detour/fixture-consumer', version: '1.0.0' }));
  const nested = copyTarget(braces, 'node_modules/@detour/fixture-consumer/node_modules/braces');
  writeFileSync(path.join(fixture, 'package-lock.json'), JSON.stringify({ packages }));
  assert.equal(patchUnreleasedSecurity(fixture).length, 3, 'All nested package copies must be guarded');
  writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ name: 'braces', version: '3.0.4' }));
  assert.throws(() => patchUnreleasedSecurity(fixture), /Unsupported braces version/);
  writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ name: 'braces', version: '3.0.3' }));
  const parseFile = path.join(nested, 'lib/parse.js');
  writeFileSync(parseFile, readFileSync(parseFile, 'utf8') + '\n// unknown change\n');
  const pendingFile = path.join(braceDirectory, 'lib/parse.js');
  writeFileSync(pendingFile, readFileSync(pendingFile, 'utf8').replaceAll("      // Detour: reject deep patterns before any recursive AST operation.\n      if (stack.length > 128) throw new SyntaxError('Brace pattern exceeds safe nesting limit');\n", ''));
  const unchanged = digest(pendingFile);
  assert.throws(() => patchUnreleasedSecurity(fixture), /Unrecognized source/);
  assert.equal(digest(pendingFile), unchanged, 'An invalid installation must not cause partial patch writes');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

const omitted = mkdtempSync(path.join(tmpdir(), 'detour-security-omitted-'));
try {
  writeFileSync(path.join(omitted, 'package-lock.json'), JSON.stringify({ packages: {
    'node_modules/braces': { version: '3.0.3' },
    'node_modules/sprintf-js': { version: '1.1.3' },
  } }));
  assert.deepEqual(patchUnreleasedSecurity(omitted), [], 'A scoped install can omit whole workspace dependency trees');
  const wrong = path.join(omitted, 'node_modules/braces');
  mkdirSync(wrong, { recursive: true });
  writeFileSync(path.join(wrong, 'package.json'), JSON.stringify({ name: 'unexpected-package', version: '3.0.3' }));
  assert.throws(() => patchUnreleasedSecurity(omitted), /Installed security patch target was not recognized/);
} finally {
  rmSync(omitted, { recursive: true, force: true });
}

const require = createRequire(import.meta.url);
for (const { directory, name } of installed) {
  if (name === 'braces') {
    const braces = require(directory);
    assert.deepEqual(braces.expand('src/{app,lib}/file-{1..3}.js'), [
      'src/app/file-1.js', 'src/app/file-2.js', 'src/app/file-3.js',
      'src/lib/file-1.js', 'src/lib/file-2.js', 'src/lib/file-3.js',
    ]);
    assert.equal(braces.compile('src/{app,lib}/*.js'), 'src/(app|lib)/*.js');
    assert.equal(braces.stringify(braces.parse('src/{app,lib}/*.js')), 'src/{app,lib}/*.js');
    assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
    assert.equal(braces.compile('"' + '{'.repeat(1000) + '"'), '{'.repeat(1000));
    assert.equal(braces.compile('[' + '{'.repeat(1000) + ']'), '[' + '{'.repeat(1000) + ']');
    assert.equal(braces.compile('\\{'.repeat(1000)), '{'.repeat(1000));
  } else {
    for (const file of ['src/sprintf.js', 'dist/sprintf.min.js']) {
      const { sprintf, vsprintf } = require(path.join(directory, file));
      assert.equal(sprintf('%s %04d %.2f', 'value', 7, 1.25), 'value 0007 1.25');
      assert.equal(vsprintf('%2$s %1$s', ['first', 'second']), 'second first');
      assert.equal(sprintf('%(value).3f', { value: 1.25 }), '1.250');
      assert.equal(sprintf('%.0f', 1.25), '1');
      assert.equal(sprintf('%.100f', 1.25), (1.25).toFixed(100));
      assert.equal(sprintf('%.3g', 1.2345), '1.23');
    }
  }
  // Hostile input runs in a subprocess with a hard timeout. A stack overflow,
  // OOM, uncaught exception, or hang cannot be mistaken for a passing guard.
  const hostile = name === 'braces' ? `
    const assert = require('node:assert/strict');
    const braces = require(${JSON.stringify(directory)});
    // Below the package's 10,000-character limit, still enough to overflow
    // the original recursive walkers on typical Node stacks.
    const balanced = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
    const unbalanced = '{'.repeat(4000) + 'a';
    const parens = '('.repeat(4000) + 'a' + ')'.repeat(4000);
    for (const input of [balanced, unbalanced, parens]) {
      for (const method of ['parse', 'compile', 'expand', 'stringify']) {
        assert.throws(() => braces[method](input), { name: 'SyntaxError', message: /safe nesting/ });
      }
    }
    let ast = { type: 'text', value: 'a' };
    for (let i = 0; i < 10000; i++) ast = { type: 'paren', nodes: [ast] };
    for (const method of ['compile', 'expand', 'stringify']) {
      const direct = require(${JSON.stringify(directory)} + '/lib/' + method);
      assert.throws(() => braces[method](ast), { name: 'SyntaxError', message: /safe nesting/ });
      assert.throws(() => direct(ast), { name: 'SyntaxError', message: /safe nesting/ });
      const cycle = { type: 'root', nodes: [] }; cycle.nodes.push(cycle);
      assert.throws(() => direct(cycle), { name: 'SyntaxError', message: /safe nesting/ });
    }
  ` : `
    const assert = require('node:assert/strict');
    for (const file of ['src/sprintf.js', 'dist/sprintf.min.js']) {
      const { sprintf, vsprintf } = require(${JSON.stringify(directory)} + '/' + file);
      for (const type of ['e', 'f', 'g']) {
        for (const precision of ['101', '1000000000', '9'.repeat(10000)]) {
          assert.equal(sprintf('%.' + precision + type, 1.25), sprintf('%.100' + type, 1.25));
          assert.equal(vsprintf('%.' + precision + type, [1.25]), sprintf('%.100' + type, 1.25));
        }
      }
      assert.equal(sprintf('%.0g', 1.25), sprintf('%.1g', 1.25));
    }
  `;
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '-e', hostile], { timeout: 5000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${name} hostile-input process was terminated`);
  assert.equal(result.status, 0, `${name} hostile-input check failed: ${result.stderr}`);
}

console.log(`Security guard regression checks passed for ${installed.length} installed package copies`);
