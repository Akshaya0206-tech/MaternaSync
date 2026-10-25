"""Build the index that lets the Reference Library search by meaning (see app/semantic_search.py).

Run from the backend folder, after fetch_search_model.py:   python build_semantic_index.py
It indexes any downloaded PDF that is not indexed yet, then gives every passage and every reference's title and summary a vector with the
multilingual model, and writes backend/search_model/multilingual-e5-small-index.npz (about 12 MB; git and the Docker build ignore it).
Texts that already have a vector are kept, so a second run only does what is new: about 4 minutes the first time for the whole
library on a laptop CPU, seconds afterwards. Run it again after attaching a PDF to a reference. The running API picks up the new
file by itself. Nothing in the database is changed except the passages of PDFs that were not indexed yet.
"""
import sys
import time

from app import models, semantic_search
from app.database import SessionLocal
from app.reference_library import index_downloaded_documents, refresh_small_passages


def main() -> int:
    if not (semantic_search.MODEL_DIR / "model_quantized.onnx").exists():
        print("The model is not downloaded. Run:  python fetch_search_model.py")
        return 1
    with SessionLocal() as db:
        index_downloaded_documents(db)  # PDFs downloaded since the API last started
        refresh_small_passages(db)  # and any PDF still split into fragments of a few words
        db.commit()
        texts = {semantic_search.text_key(c.text): c.text for c in db.query(models.ReferenceChunk).all()}
        references = {semantic_search.text_key(semantic_search.item_text(i)): semantic_search.item_text(i) for i in db.query(models.ReferenceItem).all()}
    passages = len(texts)
    texts.update(references)
    print(f"{passages} passages and {len(references)} references to index (some texts may repeat).")
    started = time.time()
    result = semantic_search.build_index(texts)
    print(f"Done in {time.time() - started:.0f}s: {result['texts']} vectors in {semantic_search.INDEX_FILE.name} "
          f"({result['new']} new, {result['kept']} kept). Restart the API if it was running before this change.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
