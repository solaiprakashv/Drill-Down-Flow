"""
Server-side drill-down logic.
Splitting is ALWAYS done here – never on the client.
"""

from typing import List, Dict, Any, Optional


def get_default_delimiter(level: int) -> str:
    """Return the default delimiter for a given drill-down level."""
    if level == 1:
        return "\n"      # paragraph → lines
    elif level == 2:
        return " "        # line → words
    else:
        return ""          # word → characters


def split_text(text: str, delimiter: str, level: int) -> List[str]:
    """
    Split *text* using *delimiter*.
    Level 3 with empty delimiter → list of individual characters.
    Empty or whitespace-only segments are filtered out.
    """
    if not text:
        return []

    # character-level decomposition
    if level == 3 and delimiter == "":
        return list(text)

    parts = text.split(delimiter)
    # preserve meaningful parts only (but keep single-char/special-char parts)
    return [p for p in parts if p != ""]


def build_flow_nodes(
    parts: List[str],
    level: int,
    document_id: str,
    parent_text: str,
    parent_index: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Build @xyflow/react-compatible nodes and edges for a list of parts.
    Layout: vertical list with a root node at the top.
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    if not parts:
        return {"nodes": nodes, "edges": edges}

    # root node (represents the parent element)
    level_labels = {1: "Paragraph", 2: "Line", 3: "Word"}
    root_label = level_labels.get(level, "Root")

    root_id = "root"
    nodes.append({
        "id": root_id,
        "type": "input",
        "data": {
            "label": f"📄 {root_label}",
            "isRoot": True,
        },
        "position": {"x": 250.0, "y": 0.0},
    })

    # distribute child nodes
    x_spacing = 200
    y_start = 120
    y_spacing = 90

    # for levels with many items, use grid layout
    cols = 1
    if len(parts) > 8:
        cols = 3
    elif len(parts) > 4:
        cols = 2

    for i, part in enumerate(parts):
        node_id = f"n-{i}"
        col = i % cols
        row = i // cols

        x = 50.0 + col * x_spacing
        y = y_start + row * y_spacing

        node_data: Dict[str, Any] = {
            "label": part,
            "index": i,
            "level": level,
            "documentId": document_id,
        }

        # for word level, mark that we can drill into characters
        if level == 2:
            node_data["canDrillDown"] = True
            node_data["nextLevel"] = 3

        # for line level, mark that we can drill into words
        if level == 1:
            node_data["canDrillDown"] = True
            node_data["nextLevel"] = 2

        nodes.append({
            "id": node_id,
            "type": "default",
            "data": node_data,
            "position": {"x": x, "y": y},
        })

        edges.append({
            "id": f"e-{i}",
            "source": root_id,
            "target": node_id,
            "type": "smoothstep",
            "animated": level < 3,
        })

    return {"nodes": nodes, "edges": edges}


# ══════════════════════════════════════════════════════════════════════════════
#  FULL TREE  – Paragraph → Lines → Words (→ Characters) in one response
# ══════════════════════════════════════════════════════════════════════════════

def build_full_tree(
    document_id: str,
    paragraph: str,
    line_delimiter: str = "\n",
    word_delimiter: str = " ",
    char_delimiter: str = "",
    depth: int = 3,
) -> Dict[str, Any]:
    """
    Build the ENTIRE decomposition tree as a single set of nodes + edges.

    depth=2 → paragraph → lines → words
    depth=3 → paragraph → lines → words → characters
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    if not paragraph or not paragraph.strip():
        return {"nodes": nodes, "edges": edges}

    lines = split_text(paragraph, line_delimiter, 1)

    # ── Geometry constants ────────────────────────────────────────────
    line_x_gap = 320        # horizontal gap between line columns
    word_y_gap = 70         # vertical gap between word rows under a line
    char_y_gap = 55         # vertical gap between char rows
    char_x_gap = 60         # horizontal gap between chars

    total_width = max(len(lines) * line_x_gap, 600)

    # ── ROOT: Paragraph ──────────────────────────────────────────────
    root_id = "para"
    nodes.append({
        "id": root_id,
        "type": "input",
        "data": {"label": "📄 Paragraph", "isRoot": True, "nodeLevel": 0},
        "position": {"x": total_width / 2 - 60, "y": 0.0},
    })

    # ── LEVEL 1: Lines ───────────────────────────────────────────────
    for li, line_text in enumerate(lines):
        line_id = f"L{li}"
        line_x = li * line_x_gap + 30
        line_y = 130.0

        nodes.append({
            "id": line_id,
            "type": "default",
            "data": {
                "label": line_text,
                "index": li,
                "level": 1,
                "nodeLevel": 1,
                "documentId": document_id,
                "canDrillDown": True,
            },
            "position": {"x": line_x, "y": line_y},
        })
        edges.append({
            "id": f"e-para-L{li}",
            "source": root_id,
            "target": line_id,
            "type": "smoothstep",
            "animated": True,
        })

        if depth < 2:
            continue

        # ── LEVEL 2: Words ───────────────────────────────────────
        words = split_text(line_text, word_delimiter, 2)

        for wi, word_text in enumerate(words):
            word_id = f"L{li}-W{wi}"
            word_x = line_x + (wi % 2) * 140 - 30
            word_y = line_y + 120 + wi * word_y_gap

            nodes.append({
                "id": word_id,
                "type": "default",
                "data": {
                    "label": word_text,
                    "index": wi,
                    "lineIndex": li,
                    "level": 2,
                    "nodeLevel": 2,
                    "documentId": document_id,
                    "canDrillDown": True,
                },
                "position": {"x": word_x, "y": word_y},
            })
            edges.append({
                "id": f"e-L{li}-W{wi}",
                "source": line_id,
                "target": word_id,
                "type": "smoothstep",
                "animated": True,
            })

            if depth < 3:
                continue

            # ── LEVEL 3: Characters ──────────────────────────
            chars = list(word_text)
            char_base_y = word_y + 80
            for ci, ch in enumerate(chars):
                char_id = f"L{li}-W{wi}-C{ci}"
                char_x = word_x - ((len(chars) - 1) * char_x_gap / 2) + ci * char_x_gap
                char_y = char_base_y

                nodes.append({
                    "id": char_id,
                    "type": "default",
                    "data": {
                        "label": ch,
                        "index": ci,
                        "wordIndex": wi,
                        "lineIndex": li,
                        "level": 3,
                        "nodeLevel": 3,
                        "documentId": document_id,
                    },
                    "position": {"x": char_x, "y": char_y},
                })
                edges.append({
                    "id": f"e-L{li}-W{wi}-C{ci}",
                    "source": word_id,
                    "target": char_id,
                    "type": "smoothstep",
                    "animated": False,
                })

    return {"nodes": nodes, "edges": edges}
