#!/usr/bin/env python3
"""One-time DOCX import: merge Armenian + English Bible DOCX files into data/*.json.

Run once to bootstrap the web editor data.  After this, the JSON files
in data/ become the source of truth and all further editing happens in
the browser.

Usage:
    python3 scripts/import_docx.py
"""
from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


# ── DOCX paragraph extraction ──────────────────────────────────────


def extract_paragraphs(docx_path: Path) -> list[str]:
    """Read plain-text paragraphs from a .docx file (stdlib only)."""
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(docx_path) as zf:
        xml_bytes = zf.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    result: list[str] = []
    for para in root.findall(".//w:body/w:p", ns):
        texts = [t.text or "" for t in para.findall(".//w:t", ns)]
        line = "".join(texts).strip()
        if line:
            result.append(line)
    return result


# ── Heuristic helpers ──────────────────────────────────────────────


def is_chapter_number(text: str) -> int | None:
    """Return chapter number if the paragraph is just a standalone integer."""
    m = re.fullmatch(r"\d{1,3}", text.strip())
    return int(m.group()) if m else None


def is_heading(text: str) -> bool:
    """Return True if a paragraph looks like a section heading (all-uppercase)."""
    alpha = [c for c in text if c.isalpha()]
    return len(alpha) > 2 and all(c.isupper() for c in alpha)


def split_verses(text: str) -> list[tuple[int, str]]:
    """Split a paragraph into (verse_number, verse_text) pairs.

    Handles false-positive digit matches (e.g. "begot 3 sons") by
    checking that verse numbers increase sequentially.
    """
    tokens = re.split(r"(\d{1,3})\s+", text.strip())
    verses: list[tuple[int, str]] = []
    expected: int | None = None
    i = 1
    while i < len(tokens) - 1:
        num = int(tokens[i])
        txt = tokens[i + 1].strip()
        if expected is None or num == expected:
            verses.append((num, txt))
            expected = num + 1
        elif verses:
            # False positive — merge back into previous verse
            prev_num, prev_txt = verses[-1]
            verses[-1] = (prev_num, f"{prev_txt} {tokens[i]} {txt}".strip())
        else:
            verses.append((num, txt))
            expected = num + 1
        i += 2
    return verses


# ── Event-based paragraph stream ───────────────────────────────────

Event = tuple[str, str | int]  # ('chapter', int) | ('heading', str) | ('text', str)


def paragraphs_to_events(paragraphs: list[str]) -> list[Event]:
    """Convert raw paragraphs into a tagged event stream."""
    events: list[Event] = []
    for para in paragraphs:
        ch = is_chapter_number(para)
        if ch is not None:
            events.append(("chapter", ch))
        elif is_heading(para):
            events.append(("heading", para))
        else:
            events.append(("text", para))
    return events


# ── Multi-book parsing ─────────────────────────────────────────────

ChapterData = dict[str, list[tuple[int, str]] | dict[int, str]]
BookChapters = dict[int, ChapterData]
BookEntry = tuple[str, BookChapters]


def parse_multibook(docx_path: Path) -> list[BookEntry]:
    """Parse a DOCX into a list of (book_name, {ch_num: {headings, verses}})."""
    paragraphs = extract_paragraphs(docx_path)
    events = paragraphs_to_events(paragraphs)

    books: list[BookEntry] = []
    current_book_name: str = ""
    current_chapters: BookChapters = {}
    current_ch: int | None = None
    max_ch: int = 0
    last_verse: int = 0

    i = 0
    while i < len(events):
        typ, val = events[i]

        # ── Detect book boundary ──────────────────────────────────
        # Pattern: HEADING followed immediately by a CHAPTER number
        # that is ≤ the highest chapter seen so far (i.e. a restart).
        if typ == "heading" and isinstance(val, str):
            if i + 1 < len(events) and events[i + 1][0] == "chapter":
                next_ch = events[i + 1][1]
                assert isinstance(next_ch, int)
                if current_book_name == "" or next_ch <= max_ch:
                    # Commit previous book
                    if current_book_name or current_chapters:
                        books.append((current_book_name, current_chapters))
                    current_book_name = val
                    current_chapters = {}
                    current_ch = None
                    max_ch = 0
                    last_verse = 0
                    i += 1
                    continue

            # Regular section heading inside current chapter
            if current_ch is not None:
                next_verse = last_verse + 1
                ch_data = current_chapters.setdefault(
                    current_ch, {"headings": [], "verses": {}}
                )
                heading_list: list[tuple[int, str]] = ch_data["headings"]  # type: ignore[assignment]
                heading_list.append((next_verse, val))
            i += 1
            continue

        # ── Chapter marker ────────────────────────────────────────
        if typ == "chapter" and isinstance(val, int):
            current_ch = val
            max_ch = max(max_ch, val)
            current_chapters.setdefault(current_ch, {"headings": [], "verses": {}})
            last_verse = 0
            i += 1
            continue

        # ── Verse text ────────────────────────────────────────────
        if typ == "text" and isinstance(val, str) and current_ch is not None:
            ch_data = current_chapters.setdefault(
                current_ch, {"headings": [], "verses": {}}
            )
            verse_dict: dict[int, str] = ch_data["verses"]  # type: ignore[assignment]
            for num, txt in split_verses(val):
                verse_dict[num] = txt
                last_verse = num

        i += 1

    # Commit final book
    if current_book_name or current_chapters:
        books.append((current_book_name, current_chapters))

    return books


# ── Filter out empty / placeholder books ───────────────────────────


def has_real_content(chapters: BookChapters) -> bool:
    """True if at least one verse has ≥10 characters of actual text."""
    for ch_data in chapters.values():
        verse_dict: dict[int, str] = ch_data["verses"]  # type: ignore[assignment]
        for txt in verse_dict.values():
            if len(txt.strip()) >= 10:
                return True
    return False


# ── Merge two parallel files ───────────────────────────────────────


def make_book_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "unknown"


def merge_chapters(
    arm_chs: BookChapters,
    eng_chs: BookChapters,
) -> list[dict[str, object]]:
    """Merge Armenian and English chapter data into a single list."""
    all_ch_nums = sorted(set(arm_chs) | set(eng_chs))
    merged: list[dict[str, object]] = []

    for ch_num in all_ch_nums:
        arm = arm_chs.get(ch_num, {"headings": [], "verses": {}})
        eng = eng_chs.get(ch_num, {"headings": [], "verses": {}})

        arm_hdg: dict[int, str] = {v: t for v, t in arm["headings"]}  # type: ignore[union-attr]
        eng_hdg: dict[int, str] = {v: t for v, t in eng["headings"]}  # type: ignore[union-attr]
        hdg_positions = sorted(set(arm_hdg) | set(eng_hdg))

        arm_verses: dict[int, str] = arm["verses"]  # type: ignore[assignment]
        eng_verses: dict[int, str] = eng["verses"]  # type: ignore[assignment]
        all_verses = sorted(set(arm_verses) | set(eng_verses))

        content: list[dict[str, object]] = []
        hdg_idx = 0

        for v_num in all_verses:
            while hdg_idx < len(hdg_positions) and hdg_positions[hdg_idx] <= v_num:
                pos = hdg_positions[hdg_idx]
                content.append(
                    {
                        "kind": "heading",
                        "armenian": arm_hdg.get(pos, ""),
                        "english": eng_hdg.get(pos, ""),
                        "classical": "",
                    }
                )
                hdg_idx += 1

            content.append(
                {
                    "kind": "verse",
                    "number": v_num,
                    "armenian": arm_verses.get(v_num, ""),
                    "english": eng_verses.get(v_num, ""),
                    "classical": "",
                    "footnotes": [],
                }
            )

        # Trailing headings
        while hdg_idx < len(hdg_positions):
            pos = hdg_positions[hdg_idx]
            content.append(
                {
                    "kind": "heading",
                    "armenian": arm_hdg.get(pos, ""),
                    "english": eng_hdg.get(pos, ""),
                    "classical": "",
                }
            )
            hdg_idx += 1

        merged.append({"number": ch_num, "content": content})

    return merged


def merge_and_write(
    arm_books: list[BookEntry],
    eng_books: list[BookEntry],
    output_dir: Path,
) -> None:
    """Merge parallel book lists and write JSON files."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Filter out empty/placeholder books
    arm_books = [(n, c) for n, c in arm_books if has_real_content(c)]
    eng_books = [(n, c) for n, c in eng_books if has_real_content(c)]

    count = min(len(arm_books), len(eng_books))
    if len(arm_books) != len(eng_books):
        print(
            f"⚠  Book count mismatch: Armenian={len(arm_books)}, English={len(eng_books)}. "
            f"Merging first {count}."
        )

    for idx in range(count):
        arm_name, arm_chs = arm_books[idx]
        eng_name, eng_chs = eng_books[idx]

        chapters = merge_chapters(arm_chs, eng_chs)
        book_id = make_book_id(eng_name)
        total_verses = sum(
            1
            for ch in chapters
            for item in ch["content"]  # type: ignore[union-attr]
            if isinstance(item, dict) and item.get("kind") == "verse"
        )

        book = {
            "id": book_id,
            "name": {
                "english": eng_name.title(),
                "armenian": arm_name,
                "classical": "",
            },
            "chapters": chapters,
        }

        out_path = output_dir / f"{book_id}.json"
        out_path.write_text(
            json.dumps(book, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(
            f"  ✓ {eng_name.title():40s} → {out_path.name:30s} "
            f"({len(chapters)} ch, {total_verses} verses)"
        )


# ── Main ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    arm_docx = root / "Krapar Asdvadzashouche Ashkharaparov.docx"
    eng_docx = root / "The Classical Armenian Bible in English.docx"
    out_dir = root / "data"

    for docx in (arm_docx, eng_docx):
        if not docx.exists():
            print(f"ERROR: {docx.name} not found at {docx}")
            raise SystemExit(1)

    print("Parsing Armenian DOCX...")
    arm_books = parse_multibook(arm_docx)
    print(f"  Found {len(arm_books)} sections (before filtering)")

    print("Parsing English DOCX...")
    eng_books = parse_multibook(eng_docx)
    print(f"  Found {len(eng_books)} sections (before filtering)")

    print("\nMerging and writing JSON files...")
    merge_and_write(arm_books, eng_books, out_dir)
    print("\nDone! JSON files are in data/")
