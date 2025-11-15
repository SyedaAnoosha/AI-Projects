import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

# Lazy imports for heavy deps
from dotenv import load_dotenv
from backend import models, schemas
from backend.auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from backend.db import engine, get_db


# -----------------------------
# Env & App Setup
# -----------------------------
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "prompt-patterns")

app = FastAPI(title="Interactive Prompt Optimizer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

# -----------------------------
# Schemas
# -----------------------------
class OptimizeRequest(BaseModel):
    raw_prompt: str = Field(..., min_length=1, description="The user's raw prompt to optimize")
    goal: Optional[str] = Field(None, description="Goal or task this prompt should achieve")
    audience: Optional[str] = Field(None, description="Target audience or tone guidance")
    style: Optional[str] = Field(None, description="Style preferences (e.g., concise, formal)")
    session_id: Optional[str] = Field(None, description="Session id to bind memory (chat/testing)")


class Citation(BaseModel):
    source: Optional[str] = None
    snippet: Optional[str] = None
    score: Optional[float] = Field(default=None, description="Retriever-provided relevance score (0-1)")


class OptimizeResponse(BaseModel):
    optimized_prompt: str
    rationale: str
    checklist: List[str] = []
    citations: List[Citation] = []


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    messages: List[ChatMessage]
    system_prompt: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    messages: List[ChatMessage]


# -----------------------------
# Minimal in-memory session store (last N messages)
# -----------------------------
SESSION_MEMORY: Dict[str, Dict[str, List[Dict[str, str]]]] = {}
MAX_HISTORY = 8


def get_session_history(user_id: str, session_id: str) -> List[Dict[str, str]]:
    user_sessions = SESSION_MEMORY.setdefault(user_id, {})
    return user_sessions.setdefault(session_id, [])


# -----------------------------
# Core RAG + LLM utilities (lazy init)
# -----------------------------
_vectorstore = None
_groq_client = None
_embed = None


def get_vectorstore():
    global _vectorstore, _embed
    if _vectorstore is not None:
        return _vectorstore

    if not PINECONE_API_KEY:
        raise HTTPException(status_code=500, detail="Pinecone API key missing")

    try:
        from langchain_pinecone import PineconeVectorStore
        try:
            from langchain_huggingface import HuggingFaceEmbeddings
        except ImportError:
            from langchain_community.embeddings import HuggingFaceEmbeddings  # fallback
        _embed = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        # Prefer constructing from existing index name to avoid direct Pinecone client dependency
        _vectorstore = PineconeVectorStore.from_existing_index(
            index_name=PINECONE_INDEX_NAME,
            embedding=_embed,
            text_key="text",
        )
        return _vectorstore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to init vectorstore: {e}")


def get_groq_client():
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key missing")
    try:
        from groq import Groq

        _groq_client = Groq(api_key=GROQ_API_KEY)
        return _groq_client
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to init Groq client: {e}")


def call_groq_chat(messages: List[Dict[str, str]], model: str = "llama-3.3-70b-versatile") -> str:
    client = get_groq_client()
    try:
        completion = client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=messages,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq chat failed: {e}")

    choice = completion.choices[0].message.content if completion.choices else ""
    return choice or ""


def retrieve_prompt_patterns(query: str, user_id: Optional[str], k: int = 4) -> List[Dict[str, Any]]:
    vs = get_vectorstore()
    results: List[Dict[str, Any]] = []
    docs_with_scores: Optional[List[Any]] = None
    namespace = f"user-{user_id}" if user_id else None

    # Prefer normalized relevance scores when supported
    if hasattr(vs, "similarity_search_with_relevance_scores"):
        kwargs = {"k": k}
        if namespace:
            kwargs["namespace"] = namespace
        docs_with_scores = vs.similarity_search_with_relevance_scores(query, **kwargs)

    if docs_with_scores is not None:
        for doc, score in docs_with_scores:
            results.append({
                "source": doc.metadata.get("source"),
                "snippet": doc.page_content[:500],
                "score": float(score) if score is not None else None,
            })
        return results

    kwargs = {"k": k}
    if namespace:
        kwargs["namespace"] = namespace
    docs = vs.similarity_search(query, **kwargs)
    for doc in docs:
        results.append({
            "source": doc.metadata.get("source"),
            "snippet": doc.page_content[:500],
            "score": None,
        })
    return results


def build_meta_prompt(raw: str, goal: Optional[str], audience: Optional[str], style: Optional[str], patterns: List[Dict[str, Any]]) -> str:
    pattern_text = "\n\n".join([
        f"Source: {p.get('source','unknown')}\nExample/Notes: {p.get('snippet','') }" for p in patterns
    ])

    return f"""
You are an expert prompt engineer optimizing a raw user prompt using a rigorous 5-step framework: Task, Context, References, Evaluate, Iterate. Improve clarity, constraints, and correctness. Use retrieval examples below as inspiration; do not copy verbatim.

Raw Prompt:
{raw}

Intent:
- Goal: {goal or 'n/a'}
- Audience/Tone: {audience or 'n/a'}
- Style Prefs: {style or 'n/a'}

Retrieved Prompt Patterns & Examples:
{pattern_text}

Deliverables:
1) Optimized Prompt (ready to paste)
2) Rationale (why these changes)
3) Checklist (3-6 bullet items to self-evaluate outputs)

Format strictly as:
<optimized> ... </optimized>
<rationale> ... </rationale>
<checklist>
- item 1
- item 2
...
</checklist>
""".strip()


def parse_structured_response(text: str) -> Dict[str, Any]:
    def extract(tag: str) -> str:
        start = text.find(f"<{tag}>")
        end = text.find(f"</{tag}>")
        if start == -1 or end == -1:
            return ""
        return text[start + len(tag) + 2: end].strip()

    optimized = extract("optimized")
    rationale = extract("rationale")
    checklist_block = extract("checklist")
    checklist = []
    if checklist_block:
        checklist = [line[2:].strip() for line in checklist_block.splitlines() if line.strip().startswith("-")]
    return {
        "optimized_prompt": optimized or text,
        "rationale": rationale or "",
        "checklist": checklist,
    }


# -----------------------------
# Routes
# -----------------------------
@app.post("/auth/register", response_model=schemas.UserRead)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    email = user_in.email.lower()
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(email=email, hashed_password=get_password_hash(user_in.password))
    user.profile = models.Profile()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form_data.username.lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    user.last_login = datetime.utcnow()
    db.add(user)
    db.commit()
    token = create_access_token(user.id)
    return schemas.Token(access_token=token)


@app.get("/auth/me", response_model=schemas.UserRead)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


def _ensure_profile(user: models.User, db: Session) -> models.Profile:
    if user.profile is None:
        profile = models.Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
        user.profile = profile
    return user.profile


@app.get("/me/preferences", response_model=schemas.ProfilePreferences)
def get_preferences(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = _ensure_profile(current_user, db)
    return profile


@app.put("/me/preferences", response_model=schemas.ProfilePreferences)
def update_preferences(
    prefs: schemas.ProfilePreferences,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(current_user, db)
    update_data = prefs.dict()
    for key, value in update_data.items():
        setattr(profile, key, value)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _get_prompt_or_404(prompt_id: str, user: models.User, db: Session) -> models.Prompt:
    try:
        prompt_uuid = UUID(prompt_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid prompt id")

    prompt = db.query(models.Prompt).filter(models.Prompt.id == prompt_uuid, models.Prompt.user_id == user.id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@app.get("/prompts", response_model=List[schemas.PromptRead])
def list_prompts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompts = (
        db.query(models.Prompt)
        .filter(models.Prompt.user_id == current_user.id)
        .order_by(models.Prompt.created_at.desc())
        .all()
    )
    return prompts


@app.post("/prompts", response_model=schemas.PromptRead)
def create_prompt(
    prompt_in: schemas.PromptCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prompt = models.Prompt(
        user_id=current_user.id,
        title=prompt_in.title,
        optimized_prompt=prompt_in.optimized_prompt,
        rationale=prompt_in.rationale,
        citations=prompt_in.citations,
        tags=prompt_in.tags,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@app.get("/prompts/{prompt_id}", response_model=schemas.PromptRead)
def read_prompt(prompt_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = _get_prompt_or_404(prompt_id, current_user, db)
    return prompt


@app.patch("/prompts/{prompt_id}", response_model=schemas.PromptRead)
def update_prompt(
    prompt_id: str,
    prompt_in: schemas.PromptUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prompt = _get_prompt_or_404(prompt_id, current_user, db)
    update_data = prompt_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prompt, key, value)
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@app.delete("/prompts/{prompt_id}")
def delete_prompt(prompt_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prompt = _get_prompt_or_404(prompt_id, current_user, db)
    db.delete(prompt)
    db.commit()
    return {"status": "deleted"}


@app.post("/analytics", response_model=schemas.AnalyticsRead)
def create_analytics(
    payload: schemas.AnalyticsCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = models.Analytics(
        user_id=current_user.id,
        prompt_id=payload.prompt_id,
        rating=payload.rating,
        metrics=payload.metrics,
        note=payload.note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(
    req: OptimizeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(current_user, db)
    effective_goal = req.goal or profile.default_goal
    effective_audience = req.audience or profile.default_audience
    effective_style = req.style or profile.default_style

    # Retrieve examples/patterns via RAG
    query_excerpt = req.raw_prompt if len(req.raw_prompt) < 200 else req.raw_prompt[:200]
    citations = retrieve_prompt_patterns(query_excerpt, str(current_user.id), k=4)

    # Build meta-prompt
    meta_prompt = build_meta_prompt(
        raw=req.raw_prompt,
        goal=effective_goal,
        audience=effective_audience,
        style=effective_style,
        patterns=citations,
    )

    # Call LLM via Groq
    messages = [
        {"role": "system", "content": "You are a meticulous prompt optimization assistant."},
        {"role": "user", "content": meta_prompt},
    ]
    result_text = call_groq_chat(messages)
    parsed = parse_structured_response(result_text)

    return OptimizeResponse(
        optimized_prompt=parsed["optimized_prompt"],
        rationale=parsed["rationale"],
        checklist=parsed["checklist"],
        citations=[Citation(**c) for c in citations],
    )


@app.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_id = req.session_id
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    if not req.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    history = get_session_history(str(current_user.id), session_id)

    payload: List[Dict[str, str]] = []
    if req.system_prompt:
        payload.append({"role": "system", "content": req.system_prompt})

    for m in history:
        payload.append({"role": m["role"], "content": m["content"]})

    for m in req.messages:
        payload.append({"role": m.role, "content": m.content})

    reply = call_groq_chat(payload)

    for m in req.messages:
        history.append({"role": m.role, "content": m.content})
    history.append({"role": "assistant", "content": reply})
    SESSION_MEMORY[str(current_user.id)][session_id] = history[-MAX_HISTORY:]

    session_record = db.query(models.ChatSession).filter(models.ChatSession.session_id == session_id).first()
    if not session_record:
        session_record = models.ChatSession(user_id=current_user.id, session_id=session_id)
        db.add(session_record)
        db.commit()

    returned_msgs = req.messages + [ChatMessage(role="assistant", content=reply)]
    return ChatResponse(reply=reply, messages=returned_msgs)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
