import type { BookSummary, BookData } from './types';

const API_BASE = '/api';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res;
      lastError = new Error(`Server error ${res.status}: ${res.statusText}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    await new Promise((r) =>
      setTimeout(r, INITIAL_BACKOFF_MS * Math.pow(2, attempt)),
    );
  }

  throw lastError ?? new Error('Request failed after retries');
}

export async function fetchBooks(): Promise<BookSummary[]> {
  const res = await fetchWithRetry(`${API_BASE}/books`);
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.statusText}`);
  return (await res.json()) as BookSummary[];
}

export async function fetchBook(id: string): Promise<BookData> {
  const res = await fetchWithRetry(`${API_BASE}/books/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch book ${id}: ${res.statusText}`);
  return (await res.json()) as BookData;
}

export async function saveBook(book: BookData): Promise<void> {
  const res = await fetchWithRetry(
    `${API_BASE}/books/${encodeURIComponent(book.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book, null, 2),
    },
  );
  if (!res.ok) throw new Error(`Failed to save book ${book.id}: ${res.statusText}`);
}

export async function createBook(book: BookData): Promise<void> {
  const res = await fetchWithRetry(`${API_BASE}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book, null, 2),
  });
  if (!res.ok) throw new Error(`Failed to create book ${book.id}: ${res.statusText}`);
}
