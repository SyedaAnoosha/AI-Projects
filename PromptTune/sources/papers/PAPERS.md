# Research Papers Index

Due to repository size limits and Git best practices, the full PDF files for referenced research papers are **not** stored directly in this repo. Large binary assets (especially many PDFs) quickly bloat clone times and make history rewrites painful.

Instead, a curated JSON manifest containing titles, publication years, topical category codes, and stable links has been added at:

`sources/papers/papers.json`

## JSON Schema (Informal)
```json
{
  "p": "Paper Title",
  "i": "https://link.to/source/or/abstract",
  "y": 2023,
  "cc": "CategoryCode"
}
```
Category codes group papers (e.g. `Prompt Engineering Techniques`, `Reasoning and In-Context Learning`, `Threat Detection and Adversarial Examples`).

## Adding a New Paper
1. Find a stable link (prefer arXiv, official conference library, or DOI page).
2. Identify the most relevant category code or create a new one if needed.
3. Append a new object to the JSON array in `sources/papers/papers.json` (maintain trailing comma style consistency or adjust formatting if using a linter).
4. Commit only the JSON change (no PDFs).