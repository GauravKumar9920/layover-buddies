import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// GHSA-vfj7-8cjw-p6xm and GHSA-hp3w-g68c-fv3c have no upstream release.
// Keep the real package versions visible to audit tools. Apply only these
// reviewed registry sources and reject changed/unrecognized installations.
const targets = new Map([['braces', '3.0.3'], ['sprintf-js', '1.1.3']]);
const hash = (source) => createHash('sha256').update(source).digest('hex');

const depthGuard = `'use strict';

// Detour: bound recursive AST walkers (GHSA-vfj7-8cjw-p6xm).
module.exports = ast => {
  const pending = [[ast, 0]];
  const seen = new WeakSet();
  let count = 0;
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth > 130 || ++count > 131072 || seen.has(node)) {
      throw new SyntaxError('Brace AST exceeds safe nesting or node limit');
    }
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      for (const child of node.nodes) pending.push([child, depth + 1]);
      if (pending.length > 131072) {
        throw new SyntaxError('Brace AST exceeds safe node limit');
      }
    }
  }
};
`;

function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error(`Unexpected patch anchor: ${label}`);
  return source.replace(before, after);
}

const recipes = {
  braces: [
    {
      file: 'lib/parse.js',
      originalHash: 'e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310',
      transform(source) {
        for (const kind of ['PARENTHESES', 'CURLY_BRACE']) {
          const anchor = `    if (value === CHAR_LEFT_${kind}) {\n`;
          source = replaceOnce(source, anchor, `${anchor}      // Detour: reject deep patterns before any recursive AST operation.\n      if (stack.length > 128) throw new SyntaxError('Brace pattern exceeds safe nesting limit');\n`, kind);
        }
        return source;
      },
    },
    ...[
      ['lib/compile.js', 'dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f', 'const compile = (ast, options = {}) => {\n'],
      ['lib/expand.js', '41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7', 'const expand = (ast, options = {}) => {\n'],
      ['lib/stringify.js', '379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a', 'module.exports = (ast, options = {}) => {\n'],
    ].map(([file, originalHash, anchor]) => ({
      file,
      originalHash,
      transform(source) {
        source = replaceOnce(source, "'use strict';\n", "'use strict';\n\nconst assertSafeDepth = require('./detour-depth-guard');\n", file);
        return replaceOnce(source, anchor, `${anchor}  assertSafeDepth(ast);\n`, file);
      },
    })),
  ],
  'sprintf-js': [
    {
      file: 'src/sprintf.js',
      originalHash: '95add43f116385be221745307fae02d06751b01d4f939df1debb17dbe2ebf4eb',
      transform(source) {
        const anchor = '                parse_tree.push(\n';
        return replaceOnce(source, anchor, `                // Detour: bound native numeric precision (GHSA-hp3w-g68c-fv3c).\n                // Clamp invalid values; valid format strings retain their output.\n                if (match[7] && /[efg]/.test(match[8])) {\n                    match[7] = String(Math.max(match[8] === 'g' ? 1 : 0, Math.min(100, Number(match[7]))))\n                }\n\n${anchor}`, 'sprintf source');
      },
    },
    {
      file: 'dist/sprintf.min.js',
      originalHash: 'bcb857eed98349cb9713aea1cdf05561eca5ec7ffed0aa04985ade0af1765980',
      transform(source) {
        source = replaceOnce(source, 'n.push({placeholder:t[0]', 'if(t[7]&&/[efg]/.test(t[8]))t[7]=String(Math.max("g"===t[8]?1:0,Math.min(100,Number(t[7]))));n.push({placeholder:t[0]', 'sprintf distribution');
        // Its upstream map contains the unpatched code and is now stale.
        return replaceOnce(source, '//# sourceMappingURL=sprintf.min.js.map', '// Detour numeric precision guard; upstream source map omitted.', 'sprintf source map');
      },
    },
  ],
};

export function findInstalledTargets(installRoot, targetNames = targets) {
  const root = path.resolve(installRoot);
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const scanRoots = new Set([path.join(root, 'node_modules')]);
  const expected = new Set();
  for (const [relative, metadata] of Object.entries(lock.packages || {})) {
    if (!relative.includes('node_modules/')) continue;
    scanRoots.add(path.join(root, relative.slice(0, relative.indexOf('node_modules/') + 'node_modules'.length)));
    const packageName = metadata.name || relative.slice(relative.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (targetNames.has(packageName)) expected.add(path.join(root, relative));
  }
  const visited = new Set();
  const found = new Map();
  const scan = (modules) => {
    if (!existsSync(modules)) return;
    const canonical = realpathSync(modules);
    if (visited.has(canonical)) return;
    visited.add(canonical);
    for (const entry of readdirSync(modules, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const directory = path.join(modules, entry.name);
      if (entry.name.startsWith('@') && entry.isDirectory()) {
        for (const scoped of readdirSync(directory, { withFileTypes: true })) inspect(path.join(directory, scoped.name));
      } else inspect(directory);
    }
  };
  const inspect = (directory) => {
    const manifest = path.join(directory, 'package.json');
    if (!existsSync(manifest)) return;
    const metadata = JSON.parse(readFileSync(manifest, 'utf8'));
    if (targetNames.has(metadata.name)) {
      const canonical = realpathSync(directory);
      found.set(canonical, { directory: canonical, name: metadata.name, version: metadata.version });
    }
    scan(path.join(directory, 'node_modules'));
  };
  for (const modules of scanRoots) scan(modules);
  for (const directory of expected) {
    // Scoped workspace installs can omit mobile/tooling dependencies still
    // recorded in the root lockfile. Absent packages cannot execute; verify
    // every copy that is actually installed, including unexpected nesting.
    if (existsSync(directory) && !found.has(realpathSync(directory))) {
      throw new Error(`Installed security patch target was not recognized: ${directory}`);
    }
  }
  return [...found.values()];
}

export function patchUnreleasedSecurity(installRoot) {
  const installed = findInstalledTargets(installRoot);
  const writes = [];
  for (const target of installed) {
    if (target.version !== targets.get(target.name)) {
      throw new Error(`Unsupported ${target.name} version ${target.version}; review the upstream fix before changing the guard`);
    }
    for (const recipe of recipes[target.name]) {
      const file = path.join(target.directory, recipe.file);
      const source = readFileSync(file, 'utf8');
      if (hash(source) === recipe.originalHash) {
        writes.push([file, recipe.transform(source)]);
      } else {
        // Undo just our known additions to verify an already patched source.
        const original = undoPatch(target.name, recipe.file, source);
        if (hash(original) !== recipe.originalHash || recipe.transform(original) !== source) {
          throw new Error(`Unrecognized source in ${file}; refusing to apply a security patch`);
        }
      }
    }
    if (target.name === 'braces') {
      const file = path.join(target.directory, 'lib/detour-depth-guard.js');
      if (existsSync(file) && readFileSync(file, 'utf8') !== depthGuard) throw new Error(`Unrecognized guard in ${file}`);
      if (!existsSync(file)) writes.push([file, depthGuard]);
    }
  }
  // Verify every installed copy before modifying any of them.
  for (const [file, source] of writes) writeFileSync(file, source);
  return installed;
}

function undoPatch(name, file, source) {
  if (name === 'braces') {
    if (file === 'lib/parse.js') {
      return source.replaceAll("      // Detour: reject deep patterns before any recursive AST operation.\n      if (stack.length > 128) throw new SyntaxError('Brace pattern exceeds safe nesting limit');\n", '');
    }
    return source.replace("\nconst assertSafeDepth = require('./detour-depth-guard');\n", '').replace('  assertSafeDepth(ast);\n', '');
  }
  if (file === 'src/sprintf.js') {
    return source.replace("                // Detour: bound native numeric precision (GHSA-hp3w-g68c-fv3c).\n                // Clamp invalid values; valid format strings retain their output.\n                if (match[7] && /[efg]/.test(match[8])) {\n                    match[7] = String(Math.max(match[8] === 'g' ? 1 : 0, Math.min(100, Number(match[7]))))\n                }\n\n", '');
  }
  return source.replace('if(t[7]&&/[efg]/.test(t[8]))t[7]=String(Math.max("g"===t[8]?1:0,Math.min(100,Number(t[7]))));', '').replace('// Detour numeric precision guard; upstream source map omitted.', '//# sourceMappingURL=sprintf.min.js.map');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const installed = patchUnreleasedSecurity(process.argv[2] || process.cwd());
  console.log(`Verified unreleased security guards for ${installed.length} installed package copies`);
}
