import type { BookData } from './types';

const MAX_SNAPSHOTS = 50;

const past: BookData[] = [];
const future: BookData[] = [];

function cloneBook(data: BookData): BookData {
  return structuredClone(data);
}

export function pushSnapshot(data: BookData): void {
  past.push(cloneBook(data));
  if (past.length > MAX_SNAPSHOTS) {
    past.shift();
  }
  future.length = 0;
}

export function undoSnapshot(current: BookData): BookData | null {
  const previous = past.pop();
  if (!previous) return null;
  future.push(cloneBook(current));
  return cloneBook(previous);
}

export function redoSnapshot(current: BookData): BookData | null {
  const next = future.pop();
  if (!next) return null;
  past.push(cloneBook(current));
  return cloneBook(next);
}

export function hasUndo(): boolean {
  return past.length > 0;
}

export function hasRedo(): boolean {
  return future.length > 0;
}
