#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve(process.argv[2] ?? 'apps/admin/dist');

const signatures = [
  {
    name: 'Supabase secret key',
    pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g,
  },
  {
    name: 'Supabase service-role JWT',
    pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*InJvbGUiOiJzZXJ2aWNlX3JvbGUi[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{16,}/g,
  },
  {
    name: 'private key material',
    pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
  },
  {
    name: 'privileged Vite environment marker',
    pattern: /VITE_(?:SUPABASE_SERVICE_KEY|GOOGLE_PRIVATE_KEY|GOOGLE_SERVICE_ACCOUNT)/g,
  },
];

const allowedExtensions = new Set(['.html', '.js', '.mjs', '.cjs', '.json', '.map', '.css']);

function extension(path) {
  const name = path.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot);
}

async function collectFiles(path) {
  const metadata = await stat(path);
  if (metadata.isFile()) return [path];

  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => collectFiles(resolve(path, entry.name))),
  );
  return nested.flat();
}

let files;
try {
  files = (await collectFiles(target)).filter((file) => allowedExtensions.has(extension(file)));
} catch (error) {
  console.error(`Admin bundle secret scan could not read ${target}: ${error.message}`);
  process.exit(2);
}

const findings = [];
for (const file of files) {
  const contents = await readFile(file, 'utf8');
  for (const signature of signatures) {
    signature.pattern.lastIndex = 0;
    if (signature.pattern.test(contents)) {
      findings.push(`${signature.name} in ${file}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Admin bundle contains privileged credential material:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Admin bundle secret scan passed (${files.length} files checked).`);
