import type { UILanguage } from '../types';

export type FootnoteDisplayMode = 'tooltip' | 'superscript';

export interface LocaleStrings {
  languageCodeLabel: string;
  appTitle: string;
  brandCode: string;

  loading: string;
  selectBookToBegin: string;
  failedLoadBooks: string;
  failedLoadBook: string;

  books: string;
  searchPlaceholder: string;
  noBooksLoaded: string;
  displayLanguage: string;

  optionsTitle: string;
  optionsSubtitle: string;
  close: string;
  footnoteMode: string;
  footnoteModeTooltip: string;
  footnoteModeSuperscript: string;
  footnoteModeTooltipHelp: string;

  chapter: string;
  chapters: string;

  columnClassical: string;
  columnArmenian: string;
  columnEnglish: string;

  toggleClassical: string;
  toggleArmenian: string;
  toggleEnglish: string;

  editing: string;
  readOnly: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  unsaved: string;
  autoSaveOn: string;

  addHeading: string;
  addVerse: string;
  addChapter: string;
  addBook: string;
  deleteHeading: string;
  deleteVerse: string;
  deleteChapter: string;
  deleteBook: string;
  dragToReorder: string;
  undo: string;
  redo: string;

  clickToEdit: string;
  addFootnote: string;
  deleteFootnote: string;
  anchorWord: string;
  pickWord: string;
  cancelPick: string;
  clickWordToAttach: string;

  poetryMode: string;
  poetryOn: string;
  poetryOff: string;

  languageEnglish: string;
  languageArmenian: string;
  languageClassical: string;
}

export type LocaleDictionary = Record<UILanguage, LocaleStrings>;
