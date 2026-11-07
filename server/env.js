/**
 * Load .env before any module reads process.env.
 *
 * Imported first in server/index.js so that engine.js (which resolves
 * DEMO_DATA_DIR at module load) sees the configured values.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');

if (fs.existsSync(envFile)) {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  } else {
    // Node < 20.12 fallback: KEY=value lines, # comments, no expansion.
    for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = value;
    }
  }
}
