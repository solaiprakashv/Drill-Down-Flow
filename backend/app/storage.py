"""
JSON storage layer – the SINGLE SOURCE OF TRUTH.
All reads/writes go through this module.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional
import threading

# Resolve data dir relative to this file → backend/data/
_BASE = Path(__file__).resolve().parent.parent / "data"
_lock = threading.Lock()


def _doc_path(doc_id: str) -> Path:
    """Return the filesystem path for a document id, safely."""
    safe = doc_id.replace("..", "").replace("/", "").replace("\\", "")
    return _BASE / f"{safe}.json"


def list_documents() -> List[dict]:
    """Return all JSON documents in the data directory."""
    docs = []
    if not _BASE.exists():
        _BASE.mkdir(parents=True, exist_ok=True)
        return docs
    for p in sorted(_BASE.glob("*.json")):
        try:
            with open(p, encoding="utf-8") as f:
                docs.append(json.load(f))
        except (json.JSONDecodeError, IOError):
            continue
    return docs


def load_document(doc_id: str) -> dict:
    """Load a single document by id. Raises FileNotFoundError if missing."""
    path = _doc_path(doc_id)
    if not path.exists():
        raise FileNotFoundError(f"Document '{doc_id}' not found")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_document(doc_id: str, data: dict) -> None:
    """Atomically persist a document back to JSON."""
    path = _doc_path(doc_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        tmp = path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        tmp.replace(path)          # atomic on the same filesystem


def delete_document(doc_id: str) -> bool:
    """Delete a document file. Returns True if deleted."""
    path = _doc_path(doc_id)
    if path.exists():
        path.unlink()
        return True
    return False


def create_document(doc_id: str, paragraph: str, metadata: Optional[dict] = None) -> dict:
    """Create and persist a brand-new document."""
    data = {
        "id": doc_id,
        "paragraph": paragraph,
        "metadata": metadata or {},
    }
    save_document(doc_id, data)
    return data
