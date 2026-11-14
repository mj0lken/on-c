import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;
const rawBase = process.env.VITE_BASE_PATH?.trim();
const normalizedBase = rawBase
  ? rawBase.endsWith('/')
    ? rawBase
    : `${rawBase}/`
  : './';

function resolveAppVersion(): string {
  const envVersion = process.env.VERSION?.trim().replace(/^v/i, '');
  if (envVersion) return envVersion;
  try {
    const tag = execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (tag) return tag.replace(/^v/i, '');
  } catch {
    // Fall through to package.json version when no git tags exist
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
      version?: string;
    };
    if (pkg.version) return pkg.version;
  } catch {
    // Ignore
  }
  return '1.0.0';
}

/**
 * Emits `dist/app/index.html` and `dist/404.html` for static web hosts (GitHub Pages)
 * so direct visits or refreshes on `/app` (e.g. `https://mj0lken.github.io/on-c/app`)
 * return HTTP 200 with zero redirect flash.
 */
function spaAppRoutePlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'onc-spa-app-route',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (normalizedBase === './') return;
      const indexFile = path.join(outDir, 'index.html');
      if (!fs.existsSync(indexFile)) return;
      const html = fs.readFileSync(indexFile, 'utf8');
      const appDir = path.join(outDir, 'app');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, 'index.html'), html, 'utf8');
      fs.writeFileSync(path.join(outDir, '404.html'), html, 'utf8');
    },
  };
}

export default defineConfig({
  base: normalizedBase,
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  plugins: [react(), spaAppRoutePlugin()],
  clearScreen: false,
  build: {
    target: 'esnext',
  },
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      // Allow serving workspaces whose directory names contain characters like ':' on macOS
      strict: false,
    },
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
