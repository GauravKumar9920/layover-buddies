import { spawn } from 'node:child_process';

const environment = {
  ...process.env,
  // Sanity's compiler requires syntactically valid config, but CI must not
  // require or accidentally expose a real content project.
  SANITY_STUDIO_PROJECT_ID: process.env.SANITY_STUDIO_PROJECT_ID || 'detourci',
  SANITY_STUDIO_DATASET: process.env.SANITY_STUDIO_DATASET || 'production',
  SANITY_STUDIO_PREVIEW_ORIGIN: process.env.SANITY_STUDIO_PREVIEW_ORIGIN || 'http://127.0.0.1:8791',
};

const child = spawn('sanity', ['build'], { env: environment, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
