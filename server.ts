/**
 * Production Bun server — serves the built static site and handles
 * the JSON data API for reading/writing book files.
 *
 * Usage:  bun run build && bun run server.ts
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const DATA_DIR = resolve(import.meta.dir, 'data');
const DIST_DIR = resolve(import.meta.dir, 'dist');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

async function handleApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  /* GET /api/books — list all books */
  if (path === '/api/books' && req.method === 'GET') {
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    const summaries = files.map((f) => {
      const data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8'));
      return {
        id: data.id,
        name: data.name,
        chapterCount: data.chapters.length,
      };
    });
    return new Response(JSON.stringify(summaries), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* POST /api/books — create a new book file */
  if (path === '/api/books' && req.method === 'POST') {
    try {
      const raw = await req.text();
      const parsed = JSON.parse(raw) as { id?: string };
      const bookId = parsed.id;
      if (!bookId || !/^[a-z0-9_-]+$/.test(bookId)) {
        return new Response(JSON.stringify({ error: 'Invalid book id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const filePath = join(DATA_DIR, `${bookId}.json`);
      if (existsSync(filePath)) {
        return new Response(JSON.stringify({ error: 'Book already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      writeFileSync(filePath, raw, 'utf-8');
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /* GET/PUT /api/books/:id */
  const match = path.match(/^\/api\/books\/([a-z0-9_-]+)$/);
  if (match) {
    const bookId = match[1]!;
    const filePath = join(DATA_DIR, `${bookId}.json`);

    if (req.method === 'GET') {
      if (existsSync(filePath)) {
        return new Response(readFileSync(filePath, 'utf-8'), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT') {
      const body = await req.text();
      writeFileSync(filePath, body, 'utf-8');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      if (existsSync(filePath)) {
        const trashDir = join(DATA_DIR, '.trash');
        if (!existsSync(trashDir)) mkdirSync(trashDir, { recursive: true });
        renameSync(filePath, join(trashDir, `${bookId}.json`));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return null;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    /* API routes */
    const apiRes = await handleApi(req);
    if (apiRes) return apiRes;

    /* Static file serving */
    const url = new URL(req.url);
    const filePath = join(
      DIST_DIR,
      url.pathname === '/' ? 'index.html' : url.pathname,
    );

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    /* SPA fallback */
    return new Response(Bun.file(join(DIST_DIR, 'index.html')));
  },
});

console.log(`Server running on http://localhost:${PORT}`);
