/* ── Data model for the Armenian Bible translation editor ── */

export interface Footnote {
  readonly id: string;
  marker: string;
  text: string;
}

export interface VerseItem {
  readonly kind: 'verse';
  number: number;
  armenian: string;
  english: string;
  classical: string;
  footnotes: Footnote[];
}

export interface HeadingItem {
  readonly kind: 'heading';
  armenian: string;
  english: string;
  classical: string;
}

export type ChapterItem = VerseItem | HeadingItem;

export interface Chapter {
  number: number;
  content: ChapterItem[];
}

export interface BookName {
  english: string;
  armenian: string;
  classical: string;
}

export interface BookData {
  id: string;
  name: BookName;
  chapters: Chapter[];
}

export interface BookSummary {
  id: string;
  name: BookName;
  chapterCount: number;
}

/* ── Type guards ── */

export function isVerse(item: ChapterItem): item is VerseItem {
  return item.kind === 'verse';
}

export function isHeading(item: ChapterItem): item is HeadingItem {
  return item.kind === 'heading';
}
