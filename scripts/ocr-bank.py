"""Extract the case's scanned reports locally; no LLM or API key is used."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import fitz

p = argparse.ArgumentParser()
p.add_argument('--input', required=True)
p.add_argument('--output', required=True)
p.add_argument('--tessdata', required=True)
args = p.parse_args()
source, target = Path(args.input), Path(args.output)
target.mkdir(parents=True, exist_ok=True)
tasks = []
for pdf in sorted(source.glob('*.pdf')):
    with fitz.open(pdf) as doc:
        tasks.extend((pdf, n) for n in range(len(doc)))

def extract(task):
    pdf, n = task
    docid = hashlib.sha256(pdf.name.encode()).hexdigest()[:12]
    out = target / f'{docid}-{n+1}.json'
    if out.exists():
        return out.name
    with fitz.open(pdf) as doc:
        page = doc[n]
        text = page.get_text().strip()
        if len(text) < 80:
            with tempfile.TemporaryDirectory() as tmp:
                img = Path(tmp) / 'page.png'
                page.get_pixmap(dpi=170, alpha=False).save(img)
                run = subprocess.run(['tesseract', str(img), 'stdout', '--tessdata-dir', args.tessdata,
                    '-l', 'rus+eng', '--psm', '3'], capture_output=True, text=True,
                    env={**os.environ, 'OMP_THREAD_LIMIT': '1'}, timeout=100)
                if run.returncode:
                    raise RuntimeError(f'{pdf.name} page {n+1}: {run.stderr[-200:]}')
                text = run.stdout.strip()
        out.write_text(json.dumps({'documentId': docid, 'filename': pdf.name,
            'page': n+1, 'text': text, 'ocr': True}, ensure_ascii=False))
    return out.name

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for i, result in enumerate(pool.map(extract, tasks), 1):
        print(f'OCR {i}/{len(tasks)} {result}', flush=True)
