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

WML = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WML}

# Footnote markers embedded in paragraph text:  \x00FN:<prefix>:<id>\x00
# The NUL bytes ensure these never collide with real text or verse-number regex.
FN_MARKER_RE = re.compile(r"\x00FN:([^:]+):(\d+)\x00")


def _strip_markers(text: str) -> str:
    """Remove all embedded footnote markers from text."""
    return FN_MARKER_RE.sub("", text)


def _parse_int(raw: str | None) -> int | None:
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _paragraph_indent_level(para: ET.Element) -> int | None:
    """Best-effort paragraph indent level from DOCX paragraph properties.

    Returns:
        1+ when indentation metadata is present, otherwise None.
    """
    ppr = para.find("w:pPr", NS)
    if ppr is None:
        return None
    ind = ppr.find("w:ind", NS)
    if ind is None:
        return None

    left_twips = (
        _parse_int(ind.get(f"{{{WML}}}start"))
        or _parse_int(ind.get(f"{{{WML}}}left"))
        or 0
    )
    left_chars = (
        _parse_int(ind.get(f"{{{WML}}}startChars"))
        or _parse_int(ind.get(f"{{{WML}}}leftChars"))
        or 0
    )

    level_from_twips = max(0, left_twips // 360)
    level_from_chars = max(0, left_chars // 200)
    level = max(level_from_twips, level_from_chars)
    return level if level > 0 else None


def _paragraph_first_line_indent_em(para: ET.Element) -> float | None:
    """Best-effort first-line indent from DOCX paragraph properties.

    Positive values indicate first-line indent; negative values indicate
    hanging indent. Returned value is in approximate em units.
    """
    ppr = para.find("w:pPr", NS)
    if ppr is None:
        return None
    ind = ppr.find("w:ind", NS)
    if ind is None:
        return None

    first_line_twips = _parse_int(ind.get(f"{{{WML}}}firstLine")) or 0
    hanging_twips = _parse_int(ind.get(f"{{{WML}}}hanging")) or 0
    twips_delta = first_line_twips - hanging_twips

    first_line_chars = _parse_int(ind.get(f"{{{WML}}}firstLineChars")) or 0
    hanging_chars = _parse_int(ind.get(f"{{{WML}}}hangingChars")) or 0
    chars_delta = first_line_chars - hanging_chars

    # firstLineChars/hangingChars are in hundredths of a character.
    em_from_chars = chars_delta / 100.0
    em_from_twips = twips_delta / 360.0
    em_value = em_from_chars if chars_delta != 0 else em_from_twips
    if abs(em_value) < 0.01:
        return None
    return round(em_value, 2)


# ── DOCX paragraph + footnote extraction ──────────────────────────


def _load_footnote_map(zf: zipfile.ZipFile) -> dict[int, str]:
    """Parse word/footnotes.xml → {footnote_id: text}."""
    if "word/footnotes.xml" not in zf.namelist():
        return {}
    fn_tree = ET.fromstring(zf.read("word/footnotes.xml"))
    result: dict[int, str] = {}
    for fn in fn_tree.findall(".//w:footnote", NS):
        fn_id_str = fn.get(f"{{{WML}}}id")
        fn_type = fn.get(f"{{{WML}}}type", "normal")
        if not fn_id_str or fn_type in ("separator", "continuationSeparator"):
            continue
        texts = [t.text or "" for t in fn.findall(".//w:t", NS)]
        text = "".join(texts).strip()
        if text:
            result[int(fn_id_str)] = text
    return result


def extract_paragraphs(
    docx_path: Path, prefix: str
) -> tuple[list[tuple[str, int | None, float | None]], dict[str, str]]:
    """Read paragraphs with inline footnote markers, plus a prefixed fn map.

    Each footnote reference in the DOCX is replaced by a NUL-delimited marker
    ``\\x00FN:<prefix>:<id>\\x00`` so that it flows harmlessly through the
    verse-number regex split and can be extracted per-verse later.

    Returns:
        (paragraphs, fn_map)  where fn_map keys are ``prefix:id``.
    """
    with zipfile.ZipFile(docx_path) as zf:
        doc_xml = zf.read("word/document.xml")
        raw_fn = _load_footnote_map(zf)

    fn_map: dict[str, str] = {f"{prefix}:{k}": v for k, v in raw_fn.items()}

    doc_tree = ET.fromstring(doc_xml)
    paragraphs: list[tuple[str, int | None, float | None]] = []

    for para in doc_tree.findall(".//w:body/w:p", NS):
        text = ""
        for run in para.findall(".//w:r", NS):
            fn_ref = run.find("w:footnoteReference", NS)
            if fn_ref is not None:
                fn_id = fn_ref.get(f"{{{WML}}}id")
                if fn_id:
                    text += f"\x00FN:{prefix}:{fn_id}\x00"
            for t_elem in run.findall("w:t", NS):
                text += t_elem.text or ""
        line = text.strip()
        indent_level = _paragraph_indent_level(para)
        first_line_indent = _paragraph_first_line_indent_em(para)
        # Keep paragraphs that have real text (ignoring markers)
        if _strip_markers(line):
            paragraphs.append((line, indent_level, first_line_indent))

    return paragraphs, fn_map


def _anchor_word_from_offset(text: str, offset: int) -> int:
    """Convert a character offset into a 1-based word index."""
    bounded_offset = max(0, min(offset, len(text)))
    before = text[:bounded_offset].rstrip()
    words = before.split()
    return max(1, len(words))


def _extract_footnotes(
    text: str, fn_map: dict[str, str]
) -> tuple[str, list[dict[str, object]]]:
    """Strip markers and return (clean_text, anchored footnotes)."""
    pieces: list[str] = []
    anchors: list[tuple[str, str, int]] = []  # (key, fn_text, raw_offset)
    last_idx = 0
    clean_len = 0

    for m in FN_MARKER_RE.finditer(text):
        seg = text[last_idx : m.start()]
        pieces.append(seg)
        clean_len += len(seg)
        key = f"{m.group(1)}:{m.group(2)}"
        fn_text = fn_map.get(key, "")
        if fn_text:
            anchors.append((key, fn_text, clean_len))
        last_idx = m.end()

    tail = text[last_idx:]
    pieces.append(tail)
    raw_clean = "".join(pieces)
    # Normalize DOCX hard/soft line breaks to plain spaces so imported source
    # formatting doesn't accidentally act like manual poetry line overrides.
    raw_clean = re.sub(r"\s+", " ", raw_clean)
    ltrim = len(raw_clean) - len(raw_clean.lstrip())
    clean_text = raw_clean.strip()

    anchored: list[dict[str, object]] = []
    for key, fn_text, raw_offset in anchors:
        adjusted_offset = max(0, raw_offset - ltrim)
        anchor_word = _anchor_word_from_offset(clean_text, adjusted_offset)
        anchored.append(
            {
                "id": key,
                "text": fn_text,
                "anchorWord": anchor_word,
            }
        )
    return clean_text, anchored


# ── Heuristic helpers ──────────────────────────────────────────────


def is_chapter_number(text: str) -> int | None:
    """Return chapter number if the paragraph is just a standalone integer."""
    m = re.fullmatch(r"\d{1,3}", _strip_markers(text).strip())
    return int(m.group()) if m else None


def is_heading(text: str) -> bool:
    """Return True if a paragraph looks like a section heading (all-uppercase)."""
    clean = _strip_markers(text)
    alpha = [c for c in clean if c.isalpha()]
    return len(alpha) > 2 and all(c.isupper() for c in alpha)


def split_verses(text: str) -> list[tuple[int, str]]:
    """Split a paragraph into (verse_number, verse_text) pairs.

    Verse text may still contain embedded footnote markers — they are
    stripped later by ``_extract_footnotes``.

    Handles false-positive digit matches by checking that verse numbers
    increase sequentially (with a small forward-gap tolerance of ≤5).
    """
    tokens = re.split(r"(\d{1,3})\s+", text.strip())
    verses: list[tuple[int, str]] = []
    expected: int | None = None
    i = 1
    while i < len(tokens) - 1:
        num = int(tokens[i])
        txt = tokens[i + 1].strip()
        # Accept if: first verse, exact next, OR small forward gap (≤5)
        if expected is None or (num >= expected and num <= expected + 5):
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

ParagraphInfo = tuple[str, int | None, float | None]
TextEvent = dict[str, object]
Event = tuple[str, object]  # ('chapter', int) | ('heading', str) | ('text', TextEvent)


def paragraphs_to_events(paragraphs: list[ParagraphInfo]) -> list[Event]:
    """Convert raw paragraphs into a tagged event stream."""
    events: list[Event] = []
    for para, indent_level, first_line_indent in paragraphs:
        ch = is_chapter_number(para)
        if ch is not None:
            events.append(("chapter", ch))
        elif is_heading(para):
            events.append(("heading", para))
        else:
            events.append(
                (
                    "text",
                    {
                        "text": para,
                        "indentLevel": indent_level,
                        "firstLineIndent": first_line_indent,
                    },
                )
            )
    return events


# ── Multi-book parsing ─────────────────────────────────────────────

# verses value keeps text + optional indent metadata
VersePayload = dict[str, object]  # { "text": str, "indentLevel": int | None, "firstLineIndent": float | None }
ChapterData = dict[str, list[tuple[int, str]] | dict[int, VersePayload]]
BookChapters = dict[int, ChapterData]
BookEntry = tuple[str, BookChapters]


def parse_multibook(docx_path: Path, prefix: str) -> tuple[list[BookEntry], dict[str, str]]:
    """Parse a DOCX into a list of (book_name, {ch_num: {headings, verses}}).

    Returns the book list and the footnote map (keyed as ``prefix:id``).
    """
    paragraphs, fn_map = extract_paragraphs(docx_path, prefix)
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
        if typ == "heading" and isinstance(val, str):
            if i + 1 < len(events) and events[i + 1][0] == "chapter":
                next_ch_raw = events[i + 1][1]
                assert isinstance(next_ch_raw, int)
                next_ch = next_ch_raw
                if current_book_name == "" or next_ch <= max_ch:
                    if current_book_name or current_chapters:
                        books.append((current_book_name, current_chapters))
                    current_book_name = _strip_markers(val)
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
                heading_list.append((next_verse, _strip_markers(val)))
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
        if typ == "text" and isinstance(val, dict) and current_ch is not None:
            ch_data = current_chapters.setdefault(
                current_ch, {"headings": [], "verses": {}}
            )
            verse_dict: dict[int, VersePayload] = ch_data["verses"]  # type: ignore[assignment]
            para_text_raw = val.get("text")
            if isinstance(para_text_raw, str):
                indent_raw = val.get("indentLevel")
                indent_level = indent_raw if isinstance(indent_raw, int) else None
                first_line_raw = val.get("firstLineIndent")
                first_line_indent = (
                    round(first_line_raw, 2)
                    if isinstance(first_line_raw, (int, float))
                    else None
                )
                # Negative firstLineIndent = Word ruler hanging indent,
                # not intentional formatting.  Strip it and the related
                # indentLevel so poetry mode works cleanly.
                if first_line_indent is not None and first_line_indent < 0:
                    first_line_indent = None
                    indent_level = None
                parsed_verses = split_verses(para_text_raw)
                for v_idx, (num, txt) in enumerate(parsed_verses):
                    verse_dict[num] = {
                        "text": txt,  # still has footnote markers
                        "indentLevel": indent_level,
                        # Only the first verse in a paragraph gets
                        # the first-line indent; subsequent verses
                        # within the same paragraph are continuations.
                        "firstLineIndent": first_line_indent if v_idx == 0 else None,
                    }
                    last_verse = num

        i += 1

    # Commit final book
    if current_book_name or current_chapters:
        books.append((current_book_name, current_chapters))

    return books, fn_map


# ── Filter out empty / placeholder books ───────────────────────────


def has_real_content(chapters: BookChapters) -> bool:
    """True if at least one verse has ≥10 characters of actual text."""
    for ch_data in chapters.values():
        verse_dict: dict[int, VersePayload] = ch_data["verses"]  # type: ignore[assignment]
        for payload in verse_dict.values():
            txt_raw = payload.get("text")
            txt = txt_raw if isinstance(txt_raw, str) else ""
            if len(_strip_markers(txt).strip()) >= 10:
                return True
    return False


# ── Merge two parallel files ───────────────────────────────────────


def make_book_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "unknown"


def merge_chapters(
    arm_chs: BookChapters,
    eng_chs: BookChapters,
    fn_map: dict[str, str],
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

        arm_verses: dict[int, VersePayload] = arm["verses"]  # type: ignore[assignment]
        eng_verses: dict[int, VersePayload] = eng["verses"]  # type: ignore[assignment]
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

            # Extract clean text + footnotes for each language
            arm_payload = arm_verses.get(
                v_num,
                {"text": "", "indentLevel": None, "firstLineIndent": None},
            )
            eng_payload = eng_verses.get(
                v_num,
                {"text": "", "indentLevel": None, "firstLineIndent": None},
            )
            arm_text_raw_obj = arm_payload.get("text")
            eng_text_raw_obj = eng_payload.get("text")
            arm_text_raw = arm_text_raw_obj if isinstance(arm_text_raw_obj, str) else ""
            eng_text_raw = eng_text_raw_obj if isinstance(eng_text_raw_obj, str) else ""
            arm_clean, arm_fns = _extract_footnotes(arm_text_raw, fn_map)
            eng_clean, eng_fns = _extract_footnotes(eng_text_raw, fn_map)
            arm_indent = arm_payload.get("indentLevel")
            eng_indent = eng_payload.get("indentLevel")
            indent_level = (
                arm_indent
                if isinstance(arm_indent, int)
                else eng_indent
                if isinstance(eng_indent, int)
                else None
            )
            arm_first_line = arm_payload.get("firstLineIndent")
            eng_first_line = eng_payload.get("firstLineIndent")
            first_line_indent = (
                arm_first_line
                if isinstance(arm_first_line, (int, float))
                else eng_first_line
                if isinstance(eng_first_line, (int, float))
                else None
            )

            verse_item: dict[str, object] = {
                "kind": "verse",
                "number": v_num,
                "armenian": arm_clean,
                "english": eng_clean,
                "classical": "",
                "footnotes": {
                    "armenian": arm_fns,
                    "english": eng_fns,
                    "classical": [],
                },
            }
            if indent_level is not None:
                verse_item["indentLevel"] = indent_level
            if first_line_indent is not None and abs(float(first_line_indent)) >= 0.01:
                verse_item["firstLineIndent"] = round(float(first_line_indent), 2)

            content.append(verse_item)

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
    fn_map: dict[str, str],
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
            f"\u26a0  Book count mismatch: Armenian={len(arm_books)}, English={len(eng_books)}. "
            f"Merging first {count}."
        )

    for idx in range(count):
        arm_name, arm_chs = arm_books[idx]
        eng_name, eng_chs = eng_books[idx]

        chapters = merge_chapters(arm_chs, eng_chs, fn_map)
        book_id = make_book_id(eng_name)
        total_verses = sum(
            1
            for ch in chapters
            for item in ch["content"]  # type: ignore[union-attr]
            if isinstance(item, dict) and item.get("kind") == "verse"
        )
        total_fns = sum(
            len(fns.get("armenian", [])) + len(fns.get("english", [])) + len(fns.get("classical", []))  # type: ignore[union-attr]
            for ch in chapters
            for item in ch["content"]  # type: ignore[union-attr]
            if isinstance(item, dict) and item.get("kind") == "verse"
            for fns in [item.get("footnotes", {})]  # type: ignore[union-attr]
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
            f"  \u2713 {eng_name.title():40s} \u2192 {out_path.name:30s} "
            f"({len(chapters)} ch, {total_verses} verses, {total_fns} footnotes)"
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
    arm_books, arm_fn_map = parse_multibook(arm_docx, "arm")
    print(f"  Found {len(arm_books)} sections, {len(arm_fn_map)} footnotes")

    print("Parsing English DOCX...")
    eng_books, eng_fn_map = parse_multibook(eng_docx, "eng")
    print(f"  Found {len(eng_books)} sections, {len(eng_fn_map)} footnotes")

    # Merge footnote maps
    fn_map = {**arm_fn_map, **eng_fn_map}

    print("\nMerging and writing JSON files...")
    merge_and_write(arm_books, eng_books, fn_map, out_dir)
    print("\nDone! JSON files are in data/")
