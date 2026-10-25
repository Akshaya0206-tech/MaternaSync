"""Download the small multilingual model that lets the Reference Library search by meaning (English, Hindi, Tamil, Telugu and more).

Run from the backend folder:   python fetch_search_model.py
Then build the index of the passages:   python build_semantic_index.py      and restart the API.

The model is multilingual-e5-small (MIT licence, by Wang et al., Microsoft), in the quantised ONNX form published by Xenova on
Hugging Face. It runs on this server with onnxruntime, which the speech-to-text library already brings. About 135 MB in all; it
goes to backend/search_model/, which git and the Docker build both ignore. Optional: without it the search keeps working by words.
The commit and the checksums of the two large files are pinned below, so what is downloaded is exactly what was reviewed.
"""
import hashlib
import sys
import urllib.error
import urllib.request

from app.semantic_search import MODEL_DIR, MODEL_REPO

REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78"
FILES = {  # file in the repository -> (name here, size in bytes, sha256 or None for the tiny files)
    "onnx/model_quantized.onnx": ("model_quantized.onnx", 118308185, "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193"),
    "tokenizer.json": ("tokenizer.json", 17082730, "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39"),
    "tokenizer_config.json": ("tokenizer_config.json", 443, None),
    "config.json": ("config.json", 658, None),
}


def fetch(remote: str, name: str, size: int, sha256: str | None) -> str:
    target = MODEL_DIR / name
    if target.exists() and target.stat().st_size == size:
        return "already downloaded"
    url = f"https://huggingface.co/{MODEL_REPO}/resolve/{REVISION}/{remote}"
    digest = hashlib.sha256()
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "MaternaSync model fetch"}), timeout=120) as response, open(partial, "wb") as out:
            while chunk := response.read(1 << 20):
                out.write(chunk)
                digest.update(chunk)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        partial.unlink(missing_ok=True)
        return f"FAILED ({error})"
    if partial.stat().st_size != size or (sha256 and digest.hexdigest() != sha256):
        partial.unlink(missing_ok=True)
        return "FAILED (the file is not the one that was reviewed: size or checksum differs)"
    partial.replace(target)
    return f"saved {size / 1e6:.1f} MB, checksum {'verified' if sha256 else 'not pinned (tiny file)'}"


if __name__ == "__main__":
    failures = 0
    for remote, (name, size, sha256) in FILES.items():
        result = fetch(remote, name, size, sha256)
        failures += result.startswith("FAILED")
        print(f"{name}: {result}")
    sys.exit(1 if failures else 0)
