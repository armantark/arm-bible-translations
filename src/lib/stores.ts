import { writable, derived, get } from 'svelte/store';
import type { BookSummary, BookData } from './types';
import { saveBook } from './api';

/* ── Core state ── */

export const books = writable<BookSummary[]>([]);
export const currentBookId = writable<string | null>(null);
export const currentChapter = writable<number>(1);
export const bookData = writable<BookData | null>(null);

/* ── Column visibility ── */

export const showArmenian = writable<boolean>(true);
export const showEnglish = writable<boolean>(true);
export const showClassical = writable<boolean>(false);

/* ── Save status ── */

export const saveStatus = writable<'idle' | 'saving' | 'saved' | 'error'>('idle');
export const isDirty = writable<boolean>(false);

/* ── Derived state ── */

export const currentChapterData = derived(
  [bookData, currentChapter],
  ([$bookData, $currentChapter]) => {
    if (!$bookData) return null;
    return $bookData.chapters.find((c) => c.number === $currentChapter) ?? null;
  },
);

export const chapterNumbers = derived(bookData, ($bookData) => {
  if (!$bookData) return [] as number[];
  return $bookData.chapters.map((c) => c.number);
});

/* ── Auto-save logic (debounced 1.5s) ── */

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleAutoSave(): void {
  isDirty.set(true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void performSave();
  }, 1500);
}

async function performSave(): Promise<void> {
  const data = get(bookData);
  if (!data) return;

  saveStatus.set('saving');
  try {
    await saveBook(data);
    saveStatus.set('saved');
    isDirty.set(false);
    setTimeout(() => {
      saveStatus.update((s) => (s === 'saved' ? 'idle' : s));
    }, 2000);
  } catch {
    saveStatus.set('error');
  }
}

export async function forceSave(): Promise<void> {
  clearTimeout(saveTimer);
  await performSave();
}

/* ── Verse mutation helper ── */

export function updateVerse(
  chapterNumber: number,
  verseNumber: number,
  field: 'armenian' | 'english' | 'classical',
  value: string,
): void {
  bookData.update((data) => {
    if (!data) return data;
    return {
      ...data,
      chapters: data.chapters.map((c) => {
        if (c.number !== chapterNumber) return c;
        return {
          ...c,
          content: c.content.map((item) => {
            if (item.kind !== 'verse' || item.number !== verseNumber) return item;
            return { ...item, [field]: value };
          }),
        };
      }),
    };
  });
  scheduleAutoSave();
}
