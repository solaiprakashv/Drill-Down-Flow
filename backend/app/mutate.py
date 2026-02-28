"""
CRUD mutation helpers.
All work on strings and indices – the caller (main.py) is responsible
for reading/writing the JSON document.
"""

from typing import List


# ── Helpers ────────────────────────────────────────────────────────────────────

def _split(text: str, delimiter: str) -> List[str]:
    """Split text, preserving empty-string semantics for char-level."""
    if delimiter == "":
        return list(text)
    return text.split(delimiter)


def _join(parts: List[str], delimiter: str) -> str:
    """Re-join parts with the delimiter."""
    if delimiter == "":
        return "".join(parts)
    return delimiter.join(parts)


# ── INSERT ─────────────────────────────────────────────────────────────────────

def insert_at(text: str, delimiter: str, position: int, value: str) -> str:
    """Insert *value* at *position* inside *text* split by *delimiter*."""
    parts = _split(text, delimiter)
    position = max(0, min(position, len(parts)))  # clamp
    parts.insert(position, value)
    return _join(parts, delimiter)


# ── DELETE ─────────────────────────────────────────────────────────────────────

def delete_at(text: str, delimiter: str, position: int) -> str:
    """Delete the element at *position*."""
    parts = _split(text, delimiter)
    if 0 <= position < len(parts):
        parts.pop(position)
    return _join(parts, delimiter)


# ── REORDER ────────────────────────────────────────────────────────────────────

def reorder(text: str, delimiter: str, from_i: int, to_i: int) -> str:
    """Move element from *from_i* to *to_i*."""
    parts = _split(text, delimiter)
    if 0 <= from_i < len(parts) and 0 <= to_i < len(parts):
        item = parts.pop(from_i)
        parts.insert(to_i, item)
    return _join(parts, delimiter)
