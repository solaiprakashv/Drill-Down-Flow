"""
Recursive Text Drill-Down API
FastAPI entry point – every drill-down and mutation is a real server request.
JSON is the single source of truth.  Neo4j is a derived graph for cross-linking.
"""

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional, List
from pathlib import Path
import json
import re

from app.models import (
    DrillDownRequest, DrillDownResponse,
    NavigateUpRequest,
    InsertRequest, DeleteRequest, ReorderRequest,
    CrossLinkTraverseRequest,
    DocumentSummary,
    CreateDocumentRequest,
    FullTreeRequest,
)
from app.storage import (
    list_documents, load_document, save_document,
    delete_document, create_document,
)
from app.drilldown import (
    get_default_delimiter, split_text, build_flow_nodes, build_full_tree,
)
from app.mutate import insert_at, delete_at, reorder
from app.graph import (
    index_document, find_common_words,
    traverse_word_parents, is_available as neo4j_available,
    delete_document_graph, reset_driver,
)
from app.rebuild import rebuild_full_graph


# ── App init ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Recursive Text Drill-Down API",
    version="1.0.0",
    description="Decomposes paragraphs → lines → words → characters with "
                "full CRUD, cross-document linking, and @xyflow/react flows.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup: index all documents into Neo4j ───────────────────────────────────

@app.on_event("startup")
def startup_index():
    """On boot, reset Neo4j driver and push every JSON document into the graph."""
    import logging
    log = logging.getLogger("app.startup")
    reset_driver()  # force fresh connection attempt
    log.info("Neo4j available: %s", neo4j_available())
    for doc in list_documents():
        try:
            index_document(doc["id"], doc.get("paragraph", ""))
        except Exception:
            pass  # Neo4j may be offline – that's fine


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "neo4j": neo4j_available(),
        "documents": len(list_documents()),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  DOCUMENTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/documents", response_model=List[DocumentSummary])
def get_documents():
    """List all loaded JSON documents with summaries."""
    docs = list_documents()
    result = []
    for d in docs:
        para = d.get("paragraph", "")
        lines = [l for l in para.split("\n") if l.strip()]
        result.append(DocumentSummary(
            id=d["id"],
            metadata=d.get("metadata", {}),
            lineCount=len(lines),
            preview=lines[0][:80] if lines else "",
        ))
    return result


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: str):
    """Fetch a single document with full content and metadata."""
    try:
        doc = load_document(doc_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{doc_id}' not found")
    return doc


@app.post("/api/documents")
def create_doc(req: CreateDocumentRequest):
    """Create a new document from user-provided data."""
    # Check if document already exists
    try:
        load_document(req.id)
        raise HTTPException(409, f"Document '{req.id}' already exists")
    except FileNotFoundError:
        pass  # Good – does not exist yet

    doc = create_document(req.id, req.paragraph, req.metadata)
    index_document(req.id, req.paragraph)
    return doc


@app.delete("/api/documents/{doc_id}")
def delete_doc(doc_id: str):
    """Delete a document from JSON and Neo4j."""
    if not delete_document(doc_id):
        raise HTTPException(404, f"Document '{doc_id}' not found")
    # Clean up Neo4j graph data
    try:
        delete_document_graph(doc_id)
    except Exception:
        pass  # Neo4j may be offline
    return {"status": "deleted", "id": doc_id}


# ── Static file serving for uploads ──────────────────────────────────────────

_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(_UPLOADS_DIR)), name="uploads")

# Allowed file types
_TEXT_EXTS = {".txt", ".md", ".text"}
_JSON_EXTS = {".json"}
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}

_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    docId: Optional[str] = Form(None),
):
    """
    Upload a file to create a new document.

    Supported files:
      - .txt / .md   → content becomes the paragraph
      - .json         → must contain { "paragraph": "..." }
      - .png/.jpg/... → stored in uploads/; empty paragraph created (add text manually)
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")

    # Read content with size guard
    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(413, "File too large (max 10 MB)")

    ext = Path(file.filename).suffix.lower()
    basename = Path(file.filename).stem
    # Sanitise doc id
    safe_id = docId or re.sub(r"[^a-zA-Z0-9_-]", "_", basename)

    # Check duplicate
    try:
        load_document(safe_id)
        raise HTTPException(409, f"Document '{safe_id}' already exists")
    except FileNotFoundError:
        pass

    paragraph = ""
    metadata = {"source": file.filename, "uploadType": "file"}
    image_url = None

    if ext in _TEXT_EXTS:
        # Plain text → paragraph
        paragraph = content.decode("utf-8", errors="replace").strip()
        metadata["fileType"] = "text"

    elif ext in _JSON_EXTS:
        # JSON → parse paragraph + metadata
        try:
            data = json.loads(content.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise HTTPException(400, f"Invalid JSON: {exc}")

        paragraph = data.get("paragraph", "")
        if not paragraph:
            raise HTTPException(400, "JSON must contain a 'paragraph' field with text")
        if "metadata" in data and isinstance(data["metadata"], dict):
            metadata.update(data["metadata"])
        metadata["fileType"] = "json"

    elif ext in _IMAGE_EXTS:
        # Image → save file, create doc with image reference
        dest = _UPLOADS_DIR / f"{safe_id}{ext}"
        dest.write_bytes(content)
        image_url = f"/uploads/{safe_id}{ext}"
        metadata["fileType"] = "image"
        metadata["imageUrl"] = image_url
        metadata["imageName"] = file.filename
        # Try OCR if available
        paragraph = _try_ocr(dest)
        if not paragraph:
            paragraph = f"[Image: {file.filename}]"
    else:
        raise HTTPException(
            400,
            f"Unsupported file type '{ext}'. "
            f"Allowed: {', '.join(sorted(_TEXT_EXTS | _JSON_EXTS | _IMAGE_EXTS))}",
        )

    doc = create_document(safe_id, paragraph, metadata)
    index_document(safe_id, paragraph)

    return {
        "status": "uploaded",
        "id": safe_id,
        "fileType": metadata.get("fileType"),
        "imageUrl": image_url,
        "lineCount": len([l for l in paragraph.split("\\n") if l.strip()]),
        "preview": paragraph[:120],
    }


def _try_ocr(image_path: Path) -> str:
    """Attempt OCR on an image. Returns extracted text or empty string."""
    try:
        from PIL import Image
        import pytesseract
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img).strip()
        return text if text else ""
    except Exception:
        return ""


# ══════════════════════════════════════════════════════════════════════════════
#  DRILL-DOWN (POST only – no client-side splitting)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/drilldown/full")
def drilldown_full(req: FullTreeRequest):
    """
    Return the FULL decomposition tree in a single response.
    Paragraph → Lines → Words → Characters (based on depth).
    No clicking required – everything rendered at once.
    """
    try:
        doc = load_document(req.documentId)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{req.documentId}' not found")

    paragraph = doc.get("paragraph", "")

    flow = build_full_tree(
        document_id=req.documentId,
        paragraph=paragraph,
        line_delimiter=req.lineDelimiter or "\n",
        word_delimiter=req.wordDelimiter or " ",
        char_delimiter=req.charDelimiter or "",
        depth=req.depth,
    )

    return {
        "documentId": req.documentId,
        "depth": req.depth,
        **flow,
    }


@app.post("/api/drilldown", response_model=DrillDownResponse)
def drilldown(req: DrillDownRequest):
    """
    Decompose text at the given level.
    Level 1: paragraph → lines
    Level 2: line → words
    Level 3: word → characters
    """
    # Validate document exists
    try:
        doc = load_document(req.documentId)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{req.documentId}' not found")

    # Resolve delimiter
    delimiter = req.delimiter if req.delimiter is not None else get_default_delimiter(req.level)

    # Determine text to split
    text = req.parentText
    if req.level == 1:
        # Use paragraph from the document directly
        text = doc.get("paragraph", "")

    # Server-side split
    parts = split_text(text, delimiter, req.level)

    # Build xyflow nodes & edges
    flow = build_flow_nodes(parts, req.level, req.documentId, req.parentText, req.parentIndex)

    return DrillDownResponse(
        documentId=req.documentId,
        level=req.level,
        parentText=text if req.level == 1 else req.parentText,
        parentIndex=req.parentIndex,
        **flow,
    )


# ══════════════════════════════════════════════════════════════════════════════
#  NAVIGATE UP  (go back to previous level)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/navigate/up")
def navigate_up(req: NavigateUpRequest):
    """Navigate one level up in the drill-down hierarchy."""
    try:
        doc = load_document(req.documentId)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{req.documentId}' not found")

    paragraph = doc.get("paragraph", "")
    lines = [l for l in paragraph.split("\n") if l != ""]

    if req.currentLevel <= 1:
        # Already at top – return document list level
        return {"level": 0, "message": "Already at document level"}

    if req.currentLevel == 2:
        # Going from words → back to lines (paragraph level)
        parts = lines
        flow = build_flow_nodes(parts, 1, req.documentId, paragraph)
        return {
            "documentId": req.documentId,
            "level": 1,
            "parentText": paragraph,
            **flow,
        }

    if req.currentLevel == 3:
        # Going from characters → back to words (line level)
        line_idx = req.lineIndex if req.lineIndex is not None else 0
        if 0 <= line_idx < len(lines):
            line_text = lines[line_idx]
        else:
            line_text = lines[0] if lines else ""

        words = [w for w in line_text.split(" ") if w]
        flow = build_flow_nodes(words, 2, req.documentId, line_text, line_idx)
        return {
            "documentId": req.documentId,
            "level": 2,
            "parentText": line_text,
            "parentIndex": line_idx,
            **flow,
        }

    raise HTTPException(400, "Invalid level")


# ══════════════════════════════════════════════════════════════════════════════
#  CRUD MUTATIONS  (all persist back to JSON)
# ══════════════════════════════════════════════════════════════════════════════

def _get_delimiter_for_level(level: int) -> str:
    return {1: "\n", 2: " ", 3: ""}.get(level, "\n")


@app.post("/api/mutate/insert")
def mutate_insert(req: InsertRequest):
    """Insert a new element (line / word / character) at any level."""
    try:
        doc = load_document(req.documentId)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{req.documentId}' not found")

    paragraph = doc.get("paragraph", "")
    lines = paragraph.split("\n")
    delimiter = _get_delimiter_for_level(req.level)

    if req.level == 1:
        # Insert a new line
        lines.insert(max(0, min(req.position, len(lines))), req.value)
        doc["paragraph"] = "\n".join(lines)

    elif req.level == 2:
        # Insert a word into a specific line
        li = req.parentIndex if req.parentIndex is not None else 0
        if 0 <= li < len(lines):
            lines[li] = insert_at(lines[li], " ", req.position, req.value)
            doc["paragraph"] = "\n".join(lines)
        else:
            raise HTTPException(400, f"Line index {li} out of range")

    elif req.level == 3:
        # Insert a character into a specific word within a line
        li = req.lineIndex if req.lineIndex is not None else (req.parentIndex if req.parentIndex is not None else 0)
        wi = req.parentIndex if req.lineIndex is not None else 0
        if 0 <= li < len(lines):
            words = lines[li].split(" ")
            if 0 <= wi < len(words):
                words[wi] = insert_at(words[wi], "", req.position, req.value)
                lines[li] = " ".join(words)
                doc["paragraph"] = "\n".join(lines)
            else:
                raise HTTPException(400, f"Word index {wi} out of range")
        else:
            raise HTTPException(400, f"Line index {li} out of range")
    else:
        raise HTTPException(400, f"Invalid level {req.level}")

    save_document(req.documentId, doc)
    index_document(req.documentId, doc["paragraph"])

    return {
        "status": "ok",
        "documentId": req.documentId,
        "paragraph": doc["paragraph"],
    }


@app.post("/api/mutate/delete")
def mutate_delete(req: DeleteRequest):
    """Delete an element (line / word / character) at any level."""
    try:
        doc = load_document(req.documentId)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{req.documentId}' not found")

    paragraph = doc.get("paragraph", "")
    lines = paragraph.split("\n")

    if req.level == 1:
        if 0 <= req.position < len(lines):
            lines.pop(req.position)
            doc["paragraph"] = "\n".join(lines)
        else:
            raise HTTPException(400, f"Position {req.position} out of range")

    elif req.level == 2:
        li = req.parentIndex if req.parentIndex is not None else 0
        if 0 <= li < len(lines):
            lines[li] = delete_at(lines[li], " ", req.position)
            doc["paragraph"] = "\n".join(lines)
        else:
            raise HTTPException(400, f"Line index {li} out of range")

    elif req.level == 3:
        # Delete a character from a specific word within a line
        li = req.lineIndex if req.lineIndex is not None else (req.parentIndex if req.parentIndex is not None else 0)
        wi = req.parentIndex if req.lineIndex is not None else 0
        if 0 <= li < len(lines):
            words = lines[li].split(" ")
            if 0 <= wi < len(words):
                words[wi] = delete_at(words[wi], "", req.position)
                # Remove word entirely if empty
                if not words[wi]:
                    words.pop(wi)
                lines[li] = " ".join(words)
                doc["paragraph"] = "\n".join(lines)
            else:
                raise HTTPException(400, f"Word index {wi} out of range")
        else:
            raise HTTPException(400, f"Line index {li} out of range")
    else:
        raise HTTPException(400, f"Invalid level {req.level}")

    save_document(req.documentId, doc)
    index_document(req.documentId, doc["paragraph"])

    return {
        "status": "ok",
        "documentId": req.documentId,
        "paragraph": doc["paragraph"],
    }


@app.post("/api/mutate/reorder")
def mutate_reorder(req: ReorderRequest):
    """Reorder an element – propagates upward to parent text."""
    try:
        doc = load_document(req.documentId)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{req.documentId}' not found")

    paragraph = doc.get("paragraph", "")
    lines = paragraph.split("\n")

    if req.level == 1:
        doc["paragraph"] = reorder(paragraph, "\n", req.fromIndex, req.toIndex)

    elif req.level == 2:
        li = req.parentIndex if req.parentIndex is not None else 0
        if 0 <= li < len(lines):
            lines[li] = reorder(lines[li], " ", req.fromIndex, req.toIndex)
            doc["paragraph"] = "\n".join(lines)
        else:
            raise HTTPException(400, f"Line index {li} out of range")

    elif req.level == 3:
        # Reorder characters within a specific word
        li = req.lineIndex if req.lineIndex is not None else (req.parentIndex if req.parentIndex is not None else 0)
        wi = req.parentIndex if req.lineIndex is not None else 0
        if 0 <= li < len(lines):
            words = lines[li].split(" ")
            if 0 <= wi < len(words):
                words[wi] = reorder(words[wi], "", req.fromIndex, req.toIndex)
                lines[li] = " ".join(words)
                doc["paragraph"] = "\n".join(lines)
            else:
                raise HTTPException(400, f"Word index {wi} out of range")
        else:
            raise HTTPException(400, f"Line index {li} out of range")
    else:
        raise HTTPException(400, f"Invalid level {req.level}")

    save_document(req.documentId, doc)
    index_document(req.documentId, doc["paragraph"])

    return {
        "status": "ok",
        "documentId": req.documentId,
        "paragraph": doc["paragraph"],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  NEO4J GRAPH MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/graph/rebuild")
def graph_rebuild():
    """
    Drop and rebuild the entire Neo4j graph from JSON documents.
    Safe – JSON is the source of truth; Neo4j is derived.
    """
    result = rebuild_full_graph()
    return result


@app.post("/api/graph/word/parents")
def graph_word_parents(req: CrossLinkTraverseRequest):
    """
    Given a word, find every (document, line, paragraph) it appears in.
    Alias for crosslinks/traverse – explicit graph endpoint.
    """
    results = traverse_word_parents(req.word, req.documentId)
    if not results:
        raise HTTPException(404, f"Word '{req.word}' not found in any document")
    return results


# ══════════════════════════════════════════════════════════════════════════════
#  CROSS-DOCUMENT LINKING
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/crosslinks")
def get_crosslinks():
    """
    Find all words that appear in more than one document.
    Returns the word, which documents contain it, and exact locations.
    """
    return find_common_words()


@app.post("/api/crosslinks/traverse")
def crosslink_traverse(req: CrossLinkTraverseRequest):
    """
    From a shared word, traverse UP to its parent line / paragraph
    in any (or a specific) document.
    """
    results = traverse_word_parents(req.word, req.documentId)
    if not results:
        raise HTTPException(404, f"Word '{req.word}' not found in any document")
    return results


# ══════════════════════════════════════════════════════════════════════════════
#  METADATA (properties panel)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/documents/{doc_id}/metadata")
def get_metadata(doc_id: str):
    """Return only the metadata fields for the properties panel."""
    try:
        doc = load_document(doc_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{doc_id}' not found")
    return doc.get("metadata", {})


@app.put("/api/documents/{doc_id}/metadata")
def update_metadata(doc_id: str, metadata: dict):
    """Update metadata fields."""
    try:
        doc = load_document(doc_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Document '{doc_id}' not found")
    doc["metadata"] = metadata
    save_document(doc_id, doc)
    return {"status": "ok", "metadata": metadata}
