#!/bin/bash
# Converts a PDF to Markdown using markitdown
# Usage: ./pdf2md.sh archivo.pdf
# Output: archivo.md (same name, .md extension)

MARKITDOWN="$HOME/markitdown-env/bin/markitdown"

if [ -z "$1" ]; then
  echo "Uso: ./pdf2md.sh archivo.pdf"
  exit 1
fi

OUTPUT="${1%.pdf}.md"
"$MARKITDOWN" "$1" > "$OUTPUT"
echo "✓ $OUTPUT"
