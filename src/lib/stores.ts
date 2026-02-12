import { writable, derived, get } from 'svelte/store';
import type {
  BookSummary,
  BookData,
  UILanguage,
  VerseFootnotes,
  WordFootnote,
  ChapterItem,
  VerseItem,
  HeadingItem,
} from './types';
import { isVerse } from './types';
import { saveBook, createBook as createBookApi } from './api';
import { getLocale, type FootnoteDisplayMode } from './locales';
import { hasRedo, hasUndo, pushSnapshot, redoSnapshot, undoSnapshot } from './undoStack';

/* ── Core state ── */

export const books = writable<BookSummary[]>([]);
export const currentBookId = writable<string | null>(null);
export const currentChapter = writable<number>(1);
export const bookData = writable<BookData | null>(null);

/* ── Column visibility ── */

export const showArmenian = writable<boolean>(true);
export const showEnglish = writable<boolean>(true);
export const showClassical = writable<boolean>(false);

/* ── Edit mode (read-only by default) ── */
// TODO: Replace this toggle with proper auth when deploying.
//       Only authenticated users should be able to enter edit mode.
export const editMode = writable<boolean>(false);

/* ── UI language ── */

export const uiLanguage = writable<UILanguage>('english');
export const locale = derived(uiLanguage, ($uiLanguage) => getLocale($uiLanguage));

/* ── UI options ── */

export const showOptions = writable<boolean>(false);
export const footnoteDisplayMode = writable<FootnoteDisplayMode>('tooltip');

/* ── Save/undo status ── */

export const saveStatus = writable<'idle' | 'saving' | 'saved' | 'error'>('idle');
export const isDirty = writable<boolean>(false);
export const canUndo = writable<boolean>(false);
export const canRedo = writable<boolean>(false);
const BOOK_ORDER_STORAGE_KEY = 'armenian-bible-book-order';

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

function syncUndoState(): void {
  canUndo.set(hasUndo());
  canRedo.set(hasRedo());
}

function moveArray<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  if (moved === undefined) return items;
  copy.splice(toIndex, 0, moved);
  return copy;
}

function persistBookOrder(list: BookSummary[]): void {
  if (typeof window === 'undefined') return;
  const ids = list.map((book) => book.id);
  window.localStorage.setItem(BOOK_ORDER_STORAGE_KEY, JSON.stringify(ids));
}

export function applyBookOrderPreference(list: BookSummary[]): BookSummary[] {
  if (typeof window === 'undefined') return list;
  const raw = window.localStorage.getItem(BOOK_ORDER_STORAGE_KEY);
  if (!raw) return list;
  try {
    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids)) return list;
    const rank = new Map<string, number>();
    ids.forEach((id, idx) => {
      if (typeof id === 'string') rank.set(id, idx);
    });
    return [...list].sort((a, b) => {
      const aRank = rank.get(a.id);
      const bRank = rank.get(b.id);
      if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
      if (aRank !== undefined) return -1;
      if (bRank !== undefined) return 1;
      return a.name.english.localeCompare(b.name.english);
    });
  } catch {
    return list;
  }
}

function renumberVerses(content: ChapterItem[]): ChapterItem[] {
  let nextVerse = 1;
  return content.map((item) => {
    if (!isVerse(item)) return item;
    return { ...item, number: nextVerse++ };
  });
}

function applyBookMutation(mutate: (data: BookData) => BookData): void {
  const current = get(bookData);
  if (!current) return;
  const next = mutate(current);
  if (next === current) return;
  pushSnapshot(current);
  bookData.set(next);
  syncUndoState();
  scheduleAutoSave();
}

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

export function undoLatest(): void {
  const current = get(bookData);
  if (!current) return;
  const previous = undoSnapshot(current);
  if (!previous) return;
  bookData.set(previous);
  syncUndoState();
  scheduleAutoSave();
}

export function redoLatest(): void {
  const current = get(bookData);
  if (!current) return;
  const next = redoSnapshot(current);
  if (!next) return;
  bookData.set(next);
  syncUndoState();
  scheduleAutoSave();
}

/* ── Verse/heading/content mutation helpers ── */

export function updateVerse(
  chapterNumber: number,
  verseNumber: number,
  field: 'armenian' | 'english' | 'classical',
  value: string,
): void {
  applyBookMutation((data) => ({
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
  }));
}

export function updateHeading(
  chapterNumber: number,
  contentIndex: number,
  field: 'armenian' | 'english' | 'classical',
  value: string,
): void {
  applyBookMutation((data) => ({
    ...data,
    chapters: data.chapters.map((c) => {
      if (c.number !== chapterNumber) return c;
      return {
        ...c,
        content: c.content.map((item, idx) => {
          if (idx !== contentIndex || item.kind !== 'heading') return item;
          return { ...item, [field]: value };
        }),
      };
    }),
  }));
}

export function insertVerseAfter(chapterNumber: number, afterIndex: number): void {
  applyBookMutation((data) => {
    const chapter = data.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) return data;

    const insertAfter = Math.max(-1, Math.min(afterIndex, chapter.content.length - 1));
    const prevVerses = chapter.content.slice(0, insertAfter + 1).filter(isVerse);
    const prevNumber = prevVerses.length > 0 ? prevVerses[prevVerses.length - 1]!.number : 0;
    const newNumber = prevNumber + 1;

    const emptyFootnotes: VerseFootnotes = { armenian: [], english: [], classical: [] };
    const newVerse: VerseItem = {
      kind: 'verse',
      number: newNumber,
      armenian: '',
      english: '',
      classical: '',
      footnotes: emptyFootnotes,
    };

    const shifted = chapter.content.map((item) => {
      if (!isVerse(item)) return item;
      if (item.number >= newNumber) {
        return { ...item, number: item.number + 1 };
      }
      return item;
    });
    shifted.splice(insertAfter + 1, 0, newVerse);

    return {
      ...data,
      chapters: data.chapters.map((c) =>
        c.number === chapterNumber ? { ...c, content: shifted } : c,
      ),
    };
  });
}

export function insertHeadingAfter(chapterNumber: number, afterIndex: number): void {
  applyBookMutation((data) => {
    const chapter = data.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) return data;
    const insertAfter = Math.max(-1, Math.min(afterIndex, chapter.content.length - 1));
    const newHeading: HeadingItem = {
      kind: 'heading',
      armenian: '',
      english: '',
      classical: '',
    };
    const content = [...chapter.content];
    content.splice(insertAfter + 1, 0, newHeading);
    return {
      ...data,
      chapters: data.chapters.map((c) =>
        c.number === chapterNumber ? { ...c, content } : c,
      ),
    };
  });
}

export function deleteItemAt(chapterNumber: number, index: number): void {
  applyBookMutation((data) => {
    const chapter = data.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) return data;
    if (index < 0 || index >= chapter.content.length) return data;

    const target = chapter.content[index];
    const deletedVerseNumber = isVerse(target) ? target.number : null;
    const content = chapter.content
      .filter((_, i) => i !== index)
      .map((item) => {
        if (deletedVerseNumber === null || !isVerse(item)) return item;
        if (item.number > deletedVerseNumber) {
          return { ...item, number: item.number - 1 };
        }
        return item;
      });

    return {
      ...data,
      chapters: data.chapters.map((c) =>
        c.number === chapterNumber ? { ...c, content } : c,
      ),
    };
  });
}

export function reorderContent(chapterNumber: number, fromIndex: number, toIndex: number): void {
  applyBookMutation((data) => {
    const chapter = data.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) return data;
    if (fromIndex < 0 || toIndex < 0) return data;
    if (fromIndex >= chapter.content.length || toIndex >= chapter.content.length) return data;
    if (fromIndex === toIndex) return data;

    const reordered = moveArray(chapter.content, fromIndex, toIndex);
    const content = renumberVerses(reordered);
    return {
      ...data,
      chapters: data.chapters.map((c) =>
        c.number === chapterNumber ? { ...c, content } : c,
      ),
    };
  });
}

/* ── Poetry mode helpers ── */

export function toggleVersePoetry(chapterNumber: number, verseNumber: number): void {
  applyBookMutation((data) => ({
    ...data,
    chapters: data.chapters.map((c) => {
      if (c.number !== chapterNumber) return c;
      return {
        ...c,
        content: c.content.map((item) => {
          if (!isVerse(item) || item.number !== verseNumber) return item;
          return { ...item, poetry: !item.poetry };
        }),
      };
    }),
  }));
}

export function setChapterPoetry(chapterNumber: number, value: boolean): void {
  applyBookMutation((data) => ({
    ...data,
    chapters: data.chapters.map((c) => {
      if (c.number !== chapterNumber) return c;
      return {
        ...c,
        content: c.content.map((item) => {
          if (!isVerse(item)) return item;
          return { ...item, poetry: value };
        }),
      };
    }),
  }));
}

export function setSectionPoetry(
  chapterNumber: number,
  headingIndex: number,
  value: boolean,
): void {
  applyBookMutation((data) => {
    const chapter = data.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) return data;

    /* Find the range of content items between headingIndex and the next heading */
    const startIdx = headingIndex + 1;
    let endIdx = chapter.content.length;
    for (let i = startIdx; i < chapter.content.length; i++) {
      if (chapter.content[i]?.kind === 'heading') {
        endIdx = i;
        break;
      }
    }

    return {
      ...data,
      chapters: data.chapters.map((c) => {
        if (c.number !== chapterNumber) return c;
        return {
          ...c,
          content: c.content.map((item, idx) => {
            if (idx < startIdx || idx >= endIdx) return item;
            if (!isVerse(item)) return item;
            return { ...item, poetry: value };
          }),
        };
      }),
    };
  });
}

/**
 * Compute a map of content-index → should-indent for poetry verses.
 * Within a consecutive run of poetry=true verses, even-positioned ones
 * (2nd, 4th, ...) get indented. Headings and non-poetry verses reset the counter.
 */
export function computePoetryIndents(content: ChapterItem[]): Map<number, boolean> {
  const indents = new Map<number, boolean>();
  let poetryRunIndex = 0;

  for (let i = 0; i < content.length; i++) {
    const item = content[i];
    if (!item || item.kind === 'heading') {
      poetryRunIndex = 0;
      continue;
    }
    if (isVerse(item) && item.poetry) {
      poetryRunIndex += 1;
      indents.set(i, poetryRunIndex % 2 === 0);
    } else {
      poetryRunIndex = 0;
    }
  }
  return indents;
}

/* ── Chapter/book helpers ── */

export function addChapter(): void {
  let nextChapterNumber = 1;
  applyBookMutation((data) => {
    const maxChapter = data.chapters.reduce(
      (max, chapter) => Math.max(max, chapter.number),
      0,
    );
    nextChapterNumber = maxChapter + 1;
    return {
      ...data,
      chapters: [
        ...data.chapters,
        {
          number: nextChapterNumber,
          content: [],
        },
      ],
    };
  });
  currentChapter.set(nextChapterNumber);
}

export function reorderChapters(fromIndex: number, toIndex: number): void {
  const current = get(currentChapter);
  let nextCurrent = current;

  applyBookMutation((data) => {
    if (fromIndex < 0 || toIndex < 0) return data;
    if (fromIndex >= data.chapters.length || toIndex >= data.chapters.length) return data;
    if (fromIndex === toIndex) return data;

    const oldCurrentChapter = data.chapters.find((c) => c.number === current) ?? null;
    const moved = moveArray(data.chapters, fromIndex, toIndex);
    const currentIdx = oldCurrentChapter ? moved.indexOf(oldCurrentChapter) : -1;
    if (currentIdx >= 0) {
      nextCurrent = currentIdx + 1;
    }

    const renumbered = moved.map((chapter, idx) => ({
      ...chapter,
      number: idx + 1,
    }));

    return {
      ...data,
      chapters: renumbered,
    };
  });

  currentChapter.set(nextCurrent);
}

function makeBookId(seed: string): string {
  const normalized = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'book';
}

export async function createBook(): Promise<void> {
  const existing = new Set(get(books).map((book) => book.id));
  const baseId = makeBookId(`book-${Date.now().toString(36)}`);
  let id = baseId;
  let suffix = 2;
  while (existing.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const bookLabel = `Book ${get(books).length + 1}`;
  const newBook: BookData = {
    id,
    name: {
      english: bookLabel,
      armenian: bookLabel,
      classical: bookLabel,
    },
    chapters: [
      {
        number: 1,
        content: [],
      },
    ],
  };

  await createBookApi(newBook);
  books.update((list) => {
    const next = [
      ...list,
      {
        id: newBook.id,
        name: newBook.name,
        chapterCount: newBook.chapters.length,
      },
    ];
    persistBookOrder(next);
    return next;
  });
  currentBookId.set(newBook.id);
  bookData.set(newBook);
  currentChapter.set(1);
  isDirty.set(false);
  saveStatus.set('idle');
}

export function reorderBooks(fromIndex: number, toIndex: number): void {
  books.update((list) => {
    if (fromIndex < 0 || toIndex < 0) return list;
    if (fromIndex >= list.length || toIndex >= list.length) return list;
    if (fromIndex === toIndex) return list;
    const next = moveArray(list, fromIndex, toIndex);
    persistBookOrder(next);
    return next;
  });
}

/* ── Footnote mutation helpers ── */

export function updateFootnotes(
  chapterNumber: number,
  verseNumber: number,
  lang: 'armenian' | 'english' | 'classical',
  mutate: (fns: WordFootnote[]) => WordFootnote[],
): void {
  applyBookMutation((data) => ({
    ...data,
    chapters: data.chapters.map((c) => {
      if (c.number !== chapterNumber) return c;
      return {
        ...c,
        content: c.content.map((item) => {
          if (!isVerse(item) || item.number !== verseNumber) return item;
          const fns: VerseFootnotes = normalizeVerseFootnotes(item.footnotes);
          return {
            ...item,
            footnotes: {
              ...fns,
              [lang]: mutate([...fns[lang]]),
            },
          };
        }),
      };
    }),
  }));
}

export function reorderFootnotes(
  chapterNumber: number,
  verseNumber: number,
  lang: 'armenian' | 'english' | 'classical',
  fromIndex: number,
  toIndex: number,
): void {
  if (fromIndex === toIndex) return;
  updateFootnotes(chapterNumber, verseNumber, lang, (arr) => {
    if (fromIndex < 0 || toIndex < 0) return arr;
    if (fromIndex >= arr.length || toIndex >= arr.length) return arr;
    return moveArray(arr, fromIndex, toIndex);
  });
}

function normalizeVerseFootnotes(raw: unknown): VerseFootnotes {
  const empty: VerseFootnotes = {
    armenian: [],
    english: [],
    classical: [],
  };
  if (!raw || typeof raw !== 'object') return empty;

  const data = raw as Record<string, unknown>;
  return {
    armenian: normalizeWordFootnotes(data.armenian),
    english: normalizeWordFootnotes(data.english),
    classical: normalizeWordFootnotes(data.classical),
  };
}

function normalizeWordFootnotes(raw: unknown): WordFootnote[] {
  if (!Array.isArray(raw)) return [];
  const result: WordFootnote[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (typeof item === 'string') {
      // Legacy shape support: ["text", ...]
      result.push({
        id: `legacy-${i + 1}`,
        text: item,
        anchorWord: i + 1,
      });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === 'string' ? rec.text : '';
    const id = typeof rec.id === 'string' ? rec.id : `fn-${i + 1}`;
    const anchorWordRaw =
      typeof rec.anchorWord === 'number'
        ? rec.anchorWord
        : typeof rec.anchor_word === 'number'
          ? rec.anchor_word
          : i + 1;
    const anchorWord = Number.isFinite(anchorWordRaw)
      ? Math.max(1, Math.floor(anchorWordRaw))
      : i + 1;
    result.push({
      id,
      text,
      anchorWord,
    });
  }
  return result;
}
