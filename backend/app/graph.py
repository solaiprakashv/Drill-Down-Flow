"""
Neo4j graph layer – stores the document graph (Paragraph → Lines → Words)
and provides cross-document word linking and traversal.
Safe to run even when Neo4j is unavailable (falls back to pure-Python).
"""

import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

# Load .env file from backend/ directory
from dotenv import load_dotenv
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path, override=True)

logger = logging.getLogger(__name__)

# ── Driver (lazy, optional) ───────────────────────────────────────────────────

_driver = None
_initialized = False

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

logger.info("Neo4j config: URI=%s  USER=%s", NEO4J_URI, NEO4J_USER)


def _get_driver():
    global _driver, _initialized
    if _initialized:
        return _driver
    _initialized = True
    try:
        from neo4j import GraphDatabase
        print(f"[Neo4j] Attempting connection to {NEO4J_URI} as {NEO4J_USER}...")
        _driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
        )
        # Quick connectivity check
        _driver.verify_connectivity()
        print(f"[Neo4j] CONNECTED to {NEO4J_URI}")
        logger.info("Neo4j connected at %s", NEO4J_URI)
    except Exception as exc:
        print(f"[Neo4j] FAILED: {exc}")
        logger.warning("Neo4j unavailable (%s) – cross-linking disabled", exc)
        _driver = None
    return _driver


def reset_driver():
    """Force a fresh connection attempt (useful on startup/reload)."""
    global _driver, _initialized
    if _driver:
        try:
            _driver.close()
        except Exception:
            pass
    _driver = None
    _initialized = False


def is_available() -> bool:
    return _get_driver() is not None


# ── Helpers ────────────────────────────────────────────────────────────────────

def normalize(word: str) -> str:
    return word.strip().lower()


# ── Index a full document into the graph ──────────────────────────────────────

def index_document(doc_id: str, paragraph: str) -> None:
    """
    Parse the paragraph into lines → words and MERGE everything into Neo4j.
    Existing data for this doc is cleared first (idempotent rebuild).
    """
    driver = _get_driver()
    if not driver:
        return

    lines = [l for l in paragraph.split("\n") if l.strip()]

    with driver.session() as session:
        # Clear old data for this document
        session.run(
            "MATCH (d:Document {id: $did})-[*]->(n) DETACH DELETE n",
            did=doc_id,
        )
        session.run(
            "MATCH (d:Document {id: $did}) DETACH DELETE d",
            did=doc_id,
        )

        # Create document + paragraph
        session.run(
            """
            CREATE (d:Document {id: $did})
            CREATE (p:Paragraph {documentId: $did, text: $text})
            CREATE (d)-[:HAS_PARAGRAPH]->(p)
            """,
            did=doc_id,
            text=paragraph,
        )

        for li, line_text in enumerate(lines):
            session.run(
                """
                MATCH (p:Paragraph {documentId: $did})
                CREATE (l:Line {documentId: $did, index: $idx, text: $text})
                CREATE (p)-[:HAS_LINE {order: $idx}]->(l)
                """,
                did=doc_id,
                idx=li,
                text=line_text,
            )

            words = [w for w in line_text.split(" ") if w.strip()]
            for wi, raw_word in enumerate(words):
                nw = normalize(raw_word)
                session.run(
                    """
                    MATCH (l:Line {documentId: $did, index: $li})
                    MERGE (w:Word {normalized: $nw})
                    CREATE (l)-[:HAS_WORD {order: $wi, raw: $raw}]->(w)
                    """,
                    did=doc_id,
                    li=li,
                    wi=wi,
                    nw=nw,
                    raw=raw_word,
                )


# ── Find common words across documents ────────────────────────────────────────

def find_common_words() -> List[Dict[str, Any]]:
    """
    Return words that appear in more than one document, with their locations.
    Falls back to a pure-Python implementation when Neo4j is unavailable.
    """
    driver = _get_driver()
    if not driver:
        return _find_common_words_fallback()

    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Document)-[:HAS_PARAGRAPH]->()-[:HAS_LINE]->(l:Line)
                  -[r:HAS_WORD]->(w:Word)
            WITH w.normalized AS word,
                 COLLECT(DISTINCT d.id) AS docs,
                 COLLECT({docId: d.id, lineIndex: l.index, lineText: l.text,
                          wordIndex: r.order, raw: r.raw}) AS occurrences
            WHERE SIZE(docs) > 1
            RETURN word, docs, occurrences
            ORDER BY SIZE(docs) DESC, word
            """
        )
        return [
            {
                "word": rec["word"],
                "documents": rec["docs"],
                "occurrences": rec["occurrences"],
            }
            for rec in result
        ]


def _find_common_words_fallback() -> List[Dict[str, Any]]:
    """Pure-Python fallback when Neo4j is not up."""
    from app.storage import list_documents

    # word → list of {docId, lineIndex, lineText, wordIndex, raw}
    index: Dict[str, List[Dict[str, Any]]] = {}

    for doc in list_documents():
        doc_id = doc["id"]
        lines = [l for l in doc.get("paragraph", "").split("\n") if l.strip()]
        for li, line_text in enumerate(lines):
            words = [w for w in line_text.split(" ") if w.strip()]
            for wi, raw in enumerate(words):
                nw = normalize(raw)
                entry = {
                    "docId": doc_id,
                    "lineIndex": li,
                    "lineText": line_text,
                    "wordIndex": wi,
                    "raw": raw,
                }
                index.setdefault(nw, []).append(entry)

    results = []
    for word, occurrences in sorted(index.items()):
        doc_ids = list({o["docId"] for o in occurrences})
        if len(doc_ids) > 1:
            results.append({
                "word": word,
                "documents": doc_ids,
                "occurrences": occurrences,
            })

    results.sort(key=lambda r: (-len(r["documents"]), r["word"]))
    return results


# ── Traverse from a shared word back up to parents in any document ────────────

def traverse_word_parents(word: str, document_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Given a word, return every (document, line, paragraph) it belongs to.
    Optionally filter to a single document.
    Falls back to pure-Python when Neo4j is unavailable.
    """
    driver = _get_driver()
    nw = normalize(word)

    if not driver:
        return _traverse_word_parents_fallback(nw, document_id)

    cypher = """
        MATCH (d:Document)-[:HAS_PARAGRAPH]->(p:Paragraph)
              -[:HAS_LINE]->(l:Line)-[r:HAS_WORD]->(w:Word {normalized: $nw})
    """
    params: dict = {"nw": nw}
    if document_id:
        cypher += " WHERE d.id = $did"
        params["did"] = document_id

    cypher += """
        RETURN d.id AS docId, l.index AS lineIndex, l.text AS lineText,
               p.text AS paragraphText, r.order AS wordIndex, r.raw AS raw
        ORDER BY d.id, l.index
    """

    with driver.session() as session:
        result = session.run(cypher, **params)
        return [dict(rec) for rec in result]


def _traverse_word_parents_fallback(
    nw: str, document_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    from app.storage import list_documents

    results = []
    for doc in list_documents():
        did = doc["id"]
        if document_id and did != document_id:
            continue
        paragraph = doc.get("paragraph", "")
        lines = [l for l in paragraph.split("\n") if l.strip()]
        for li, line_text in enumerate(lines):
            words = [w for w in line_text.split(" ") if w.strip()]
            for wi, raw in enumerate(words):
                if normalize(raw) == nw:
                    results.append({
                        "docId": did,
                        "lineIndex": li,
                        "lineText": line_text,
                        "paragraphText": paragraph,
                        "wordIndex": wi,
                        "raw": raw,
                    })
    return results


# ── Delete a document from the graph ──────────────────────────────────────────

def delete_document_graph(doc_id: str) -> None:
    """Remove all graph nodes & relationships for a document."""
    driver = _get_driver()
    if not driver:
        return
    with driver.session() as session:
        session.run(
            "MATCH (d:Document {id: $did})-[*]->(n) DETACH DELETE n",
            did=doc_id,
        )
        session.run(
            "MATCH (d:Document {id: $did}) DETACH DELETE d",
            did=doc_id,
        )
    logger.info("Deleted graph data for document %s", doc_id)
