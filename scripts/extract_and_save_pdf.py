"""Small helper to extract invoice data from a local PDF and save/post it.

Usage:
  python scripts/extract_and_save_pdf.py "C:\\Users\\tsaka\\Downloads\\16110338300_20251001.PDF"

Options:
  --post       Attempt to POST the file to a running backend at /api/invoice-upload (requires `requests`).
  --url URL    Override the backend URL (default: http://127.0.0.1:3001/api/invoice-upload)

The script imports `extract_invoice_data_from_pdf` from `main.py` (this file) and will append
the normalized invoice summary to the `LAST_INVOICES_JSON_PATH` file used by the backend.
"""
from __future__ import annotations

import os
import sys
import argparse
import json
from typing import Any


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    parser = argparse.ArgumentParser(description="Extract invoice from PDF and save/post it")
    parser.add_argument("file", help="Path to the PDF file to process")
    parser.add_argument("--post", action="store_true", help="POST the file to a running backend (needs requests)")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:3001/api/invoice-upload",
        help="Backend upload URL (default: http://127.0.0.1:3001/api/invoice-upload)",
    )
    args = parser.parse_args(argv)

    pdf_path = args.file
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return 2

    try:
        # Import extractor and helpers from main.py in the repo
        from main import (
            extract_invoice_data_from_pdf,
            LAST_INVOICES_JSON_PATH,
            _safe_read_json,
            _safe_write_json,
        )
    except Exception as e:
        print("Failed to import extractor from `main.py` in this workspace:", e)
        print("Make sure you're running this script from the repository root where `main.py` lives.")
        return 3

    with open(pdf_path, "rb") as f:
        content = f.read()

    filename = os.path.basename(pdf_path)
    print(f"Extracting invoice from: {filename}")
    try:
        summary = extract_invoice_data_from_pdf(content, filename)
    except Exception as e:
        print("Extraction failed:", e)
        return 4

    # Pretty print extracted summary
    try:
        print(json.dumps(summary, indent=2, default=str))
    except Exception:
        print(summary)

    # Append to backend disk snapshot file
    try:
        existing = _safe_read_json(LAST_INVOICES_JSON_PATH, []) or []
        existing.append(summary)
        _safe_write_json(LAST_INVOICES_JSON_PATH, existing)
        print(f"Appended invoice to: {LAST_INVOICES_JSON_PATH}")
    except Exception as e:
        print("Failed to append to last invoices file:", e)

    # Optionally POST to running backend upload endpoint
    if args.post:
        try:
            import requests

            url = args.url
            files = {"file": (filename, content, "application/pdf")}
            print(f"Posting to {url} ...")
            r = requests.post(url, files=files, timeout=30)
            try:
                print("Response:", r.status_code, r.text)
            except Exception:
                print("Posted, response status:", r.status_code)
        except ImportError:
            print("`requests` is not installed. Install with: pip install requests")
        except Exception as e:
            print("Failed to POST to backend:", e)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
