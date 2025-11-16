import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "prompt-patterns")

if not PINECONE_API_KEY:
    raise RuntimeError("PINECONE_API_KEY missing in .env")

# ------------------- IMPORTS -------------------
from langchain_community.document_loaders import (
    UnstructuredMarkdownLoader,
    UnstructuredPDFLoader,
    ArxivLoader,
    JSONLoader,
    PyPDFLoader,
)
from langchain_huggingface import HuggingFaceEmbeddings   # NEW
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
import tqdm

# ------------------- PATHS -------------------
BASE_DIR = Path(__file__).parent.parent
SOURCES_DIR = BASE_DIR / "sources"
SOURCES_DIR.mkdir(exist_ok=True)

# ------------------- HELPERS -------------------
def load_markdown_folder(folder: Path):
    """Load every .md file with UnstructuredMarkdownLoader (no libmagic)"""
    if not folder.is_dir():
        return
    for md_file in folder.rglob("*.md"):
        try:
            yield UnstructuredMarkdownLoader(str(md_file))
        except Exception as e:
            print(f"Warning: Skipping {md_file}: {e}")

def load_pdfs_with_fallback(papers_dir: Path):
    """PyPDF → fallback to UnstructuredPDF"""
    if not papers_dir.is_dir():
        return
    for pdf_file in papers_dir.glob("*.pdf"):
        try:
            yield PyPDFLoader(str(pdf_file))
        except Exception:
            print(f"Warning: PyPDF failed on {pdf_file.name}, using UnstructuredPDFLoader")
            yield UnstructuredPDFLoader(str(pdf_file))

# ------------------- BUILD LOADERS -------------------
loaders = []

# Markdown folders
for folder_name in ["promptingguide", "awesome-prompt", "claude"]:
    folder = SOURCES_DIR / folder_name
    loaders.extend(load_markdown_folder(folder))

# PDFs
papers_dir = SOURCES_DIR / "papers"
loaders.extend(load_pdfs_with_fallback(papers_dir))

# Optional ArXiv
if os.getenv("INGEST_ARXIV", "0") == "1":
    loaders.append(ArxivLoader(query="prompt engineering OR chain of thought", load_max_docs=20))

# Optional custom JSON
custom_json = SOURCES_DIR / "my_refinements.json"
if custom_json.is_file():
    loaders.append(JSONLoader(str(custom_json), jq_schema=".[]"))

# ------------------- LOAD DOCS -------------------
docs = []
for loader in tqdm.tqdm(loaders, desc="Loading documents"):
    try:
        docs.extend(loader.load())
    except Exception as e:
        print(f"Loader failed: {e}")

if not docs:
    print("No documents found. Add .md/.pdf files under sources/ and re-run.")
    exit(0)

# ------------------- SPLIT -------------------
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(docs)
print(f"Total chunks: {len(chunks)}")

# ------------------- EMBED + UPSERT -------------------
embed = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
batch_size = 100

for i in tqdm.tqdm(range(0, len(chunks), batch_size), desc="Upserting"):
    batch = chunks[i:i + batch_size]
    if i == 0:
        PineconeVectorStore.from_documents(
            batch, embed, index_name=PINECONE_INDEX_NAME
        )
    else:
        PineconeVectorStore(index_name=PINECONE_INDEX_NAME, embedding=embed).add_documents(batch)

# ------------------- FINAL STATS -------------------
try:
    pc = Pinecone(api_key=PINECONE_API_KEY)
    stats = pc.Index(PINECONE_INDEX_NAME).describe_index_stats()
    print("Ingestion complete! Stats:", stats)
except Exception as e:
    print("Ingestion complete (stats unavailable):", e)