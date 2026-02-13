/* ── Data model for the Armenian Bible translation editor ── */

export type UILanguage = 'english' | 'armenian' | 'classical';

export interface WordFootnote {
  id: string;
  text: string;
  /** 1-based word index in the verse text */
  anchorWord: number;
}

export interface VerseFootnotes {
  armenian: WordFootnote[];
  english: WordFootnote[];
  classical: WordFootnote[];
}

export interface VerseItem {
  readonly kind: 'verse';
  number: number;
  armenian: string;
  english: string;
  classical: string;
  footnotes: VerseFootnotes;
  /** When true, this verse is part of a poetry section (alternating indentation). */
  poetry?: boolean;
  /** Optional imported paragraph indent level from DOCX (q-like override). */
  indentLevel?: number;
  /** Optional imported DOCX first-line indent (em units, can be negative for hanging). */
  firstLineIndent?: number;
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

/* ── i18n helpers ── */

export function bookDisplayName(
  name: BookName,
  lang: UILanguage,
): string {
  return name[lang] || name.english;
}
