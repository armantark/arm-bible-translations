import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

function bibleApiPlugin(): Plugin {
  const dataDir = resolve('data');

  return {
    name: 'bible-api',
    configureServer(server: ViteDevServer) {
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url ?? '';

          // GET /api/books — list available books
          if (url === '/api/books' && req.method === 'GET') {
            const files = readdirSync(dataDir).filter((f) =>
              f.endsWith('.json'),
            );
            const summaries = files.map((f) => {
              const raw = readFileSync(join(dataDir, f), 'utf-8');
              const data = JSON.parse(raw);
              return {
                id: data.id,
                name: data.name,
                chapterCount: data.chapters.length,
              };
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(summaries));
            return;
          }

          // GET/PUT /api/books/:id
          const match = url.match(/^\/api\/books\/([a-z0-9_-]+)$/);
          if (match) {
            const bookId = match[1]!;
            const filePath = join(dataDir, `${bookId}.json`);

            if (req.method === 'GET') {
              if (existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(readFileSync(filePath, 'utf-8'));
              } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
              }
              return;
            }

            if (req.method === 'PUT') {
              let body = '';
              req.on('data', (chunk: Buffer | string) => {
                body += typeof chunk === 'string' ? chunk : chunk.toString();
              });
              req.on('end', () => {
                writeFileSync(filePath, body, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
              });
              return;
            }
          }

          next();
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [svelte(), bibleApiPlugin()],
});
