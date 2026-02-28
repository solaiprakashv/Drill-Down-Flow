from app.graph import index_document
from app.storage import list_documents

docs = list_documents()
for d in docs:
    index_document(d["id"], d.get("paragraph", ""))
    print(f"  Indexed {d['id']}")
print(f"Total documents: {len(docs)}")
