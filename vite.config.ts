import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Runs the Vercel functions in /api during `npm run dev`, so the app works
 * locally the same way it does when deployed. Not used in production builds.
 */
const vercelApiDev = (env: Record<string, string>): Plugin => ({
  name: 'vercel-api-dev',
  apply: 'serve',
  configureServer(server: ViteDevServer) {
    // Server-side code reads keys from process.env, as it does on Vercel
    for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      try {
        const name = req.url.split('?')[0].replace(/^\/api\//, '');
        if (!/^[a-z0-9-]+$/i.test(name)) {
          res.statusCode = 404;
          return res.end();
        }
        const mod = await server.ssrLoadModule(`/api/${name}.ts`);
        const handler = mod[req.method || 'GET'];
        if (typeof handler !== 'function') {
          res.statusCode = 405;
          return res.end();
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const h of ['authorization', 'content-type']) {
          const v = req.headers[h];
          if (typeof v === 'string') headers.set(h, v);
        }
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        });
        const response: Response = await handler(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        next(err);
      }
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      // No API keys are injected into the browser bundle: AI calls go through /api.
      plugins: [react(), vercelApiDev(env)],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
