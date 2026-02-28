"""
Rebuild the entire Neo4j graph from all JSON documents.
This is a safe operation – JSON is the source of truth,
Neo4j is rebuilt as a derived index.
"""

import logging
from typing import Dict, Any

from app.storage import list_documents
from app.graph import index_document, _get_driver, is_available

logger = logging.getLogger(__name__)


def rebuild_full_graph() -> Dict[str, Any]:
    """
    Drop all Neo4j data and re-index every JSON document.

    Returns a summary dict with status and document count.
    Safe to call at any time – idempotent.
    """
    if not is_available():
        return {
            "status": "skipped",
            "reason": "Neo4j is unavailable",
            "documents": 0,
        }

    driver = _get_driver()

    # ── Clear entire graph ────────────────────────────────────────────
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
    logger.info("Neo4j graph cleared")

    # ── Re-index every document ───────────────────────────────────────
    docs = list_documents()
    indexed = 0
    errors = []

    for doc in docs:
        doc_id = doc.get("id", "unknown")
        paragraph = doc.get("paragraph", "")
        try:
            index_document(doc_id, paragraph)
            indexed += 1
            logger.info("Indexed %s", doc_id)
        except Exception as exc:
            logger.warning("Failed to index %s: %s", doc_id, exc)
            errors.append({"docId": doc_id, "error": str(exc)})

    return {
        "status": "rebuilt",
        "documents": indexed,
        "errors": errors,
    }
