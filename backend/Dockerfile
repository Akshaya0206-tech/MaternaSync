# The MaternaSync API, for a host that keeps a process running (Render, Railway, Fly.io, a VPS).
# The build context is this folder:   docker build -t maternasync-api backend
# Run it:   docker run -p 8000:8000 -v maternasync-data:/data -e MATERNASYNC_JWT_SECRET=<a long random value> maternasync-api
FROM python:3.11-slim

# pytesseract is only a wrapper: reading a scanned document needs the Tesseract program itself.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# The openly licensed reference PDFs (about 23 MB) are not kept in git. Fetch them so passage search works; if the publishers cannot be
# reached while building, those documents simply stay links and `python fetch_reference_documents.py` can be run later.
RUN python fetch_reference_documents.py || echo "The reference PDFs could not be downloaded now."

# The database and uploaded files live on /data, which must be a persistent disk or volume, or they are lost at every restart.
ENV PYTHONUNBUFFERED=1 \
    MATERNASYNC_DATABASE_URL=sqlite:////data/maternasync.db \
    MATERNASYNC_UPLOAD_DIR=/data/uploads
VOLUME /data
EXPOSE 8000

# The first start creates the database, adds the demonstration data and indexes the reference PDFs, which takes a minute or more.
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD python -c "import os, urllib.request as u; u.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT', '8000'), timeout=4)" || exit 1

# One worker only: the database is SQLite and the care assistant's background jobs must not run twice.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
