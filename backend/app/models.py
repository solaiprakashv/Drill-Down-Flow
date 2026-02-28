"""
Pydantic models for every request / response in the Recursive Text Drill-Down API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ── Drill-Down ────────────────────────────────────────────────────────────────

class DrillDownRequest(BaseModel):
    documentId: str
    level: int = Field(..., ge=1, le=3, description="1=paragraph→lines, 2=line→words, 3=word→chars")
    parentText: str
    parentIndex: Optional[int] = None
    delimiter: Optional[str] = None  # None → use default for level


class FlowNode(BaseModel):
    id: str
    type: str = "default"
    data: Dict[str, Any]
    position: Dict[str, float]


class FlowEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str = "smoothstep"
    animated: bool = False


class DrillDownResponse(BaseModel):
    documentId: str
    level: int
    parentText: str
    parentIndex: Optional[int] = None
    nodes: List[FlowNode]
    edges: List[FlowEdge]


# ── Navigate Up ───────────────────────────────────────────────────────────────

class NavigateUpRequest(BaseModel):
    documentId: str
    currentLevel: int = Field(..., ge=1, le=3)
    lineIndex: Optional[int] = None
    wordIndex: Optional[int] = None


# ── CRUD: Insert ──────────────────────────────────────────────────────────────

class InsertRequest(BaseModel):
    documentId: str
    level: int = Field(..., ge=1, le=3)
    parentIndex: Optional[int] = None   # line index for word ops, word index for char ops
    lineIndex: Optional[int] = None     # explicit line index (required for level-3 char ops)
    position: int                        # where to insert
    value: str


# ── CRUD: Delete ──────────────────────────────────────────────────────────────

class DeleteRequest(BaseModel):
    documentId: str
    level: int = Field(..., ge=1, le=3)
    parentIndex: Optional[int] = None
    lineIndex: Optional[int] = None     # explicit line index (required for level-3 char ops)
    position: int


# ── CRUD: Reorder ─────────────────────────────────────────────────────────────

class ReorderRequest(BaseModel):
    documentId: str
    level: int = Field(..., ge=1, le=3)
    parentIndex: Optional[int] = None
    lineIndex: Optional[int] = None     # explicit line index (required for level-3 char ops)
    fromIndex: int
    toIndex: int


# ── Cross-Link ────────────────────────────────────────────────────────────────

class CrossLinkResult(BaseModel):
    word: str
    occurrences: List[Dict[str, Any]]


class CrossLinkTraverseRequest(BaseModel):
    word: str
    documentId: Optional[str] = None


# ── Document creation ─────────────────────────────────────────────────────────

class CreateDocumentRequest(BaseModel):
    id: str
    paragraph: str
    metadata: Optional[Dict[str, Any]] = None


# ── Full tree request ─────────────────────────────────────────────────────────

class FullTreeRequest(BaseModel):
    documentId: str
    depth: int = Field(default=2, ge=1, le=3, description="1=lines only, 2=lines+words, 3=lines+words+chars")
    lineDelimiter: Optional[str] = None
    wordDelimiter: Optional[str] = None
    charDelimiter: Optional[str] = None


# ── Document listing ──────────────────────────────────────────────────────────

class DocumentSummary(BaseModel):
    id: str
    metadata: Dict[str, Any]
    lineCount: int
    preview: str
