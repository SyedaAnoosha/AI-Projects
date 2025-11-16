import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

# Lazy imports for heavy deps
from dotenv import load_dotenv

# Load environment variables before importing modules that depend on them
REPO_ROOT = Path(__file__).resolve().parents[1]
env_candidates = [
    REPO_ROOT / ".env",
    REPO_ROOT / "backend/.env",
    REPO_ROOT / "frontend/.env",
]

loaded_any = False
for candidate in env_candidates:
    if candidate.exists():
        load_dotenv(candidate, override=False)
        loaded_any = True

if not loaded_any:
    # Fall back to default search (current working directory + parents)
    load_dotenv()

from backend import models, schemas
from backend.auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from backend.db import engine, get_db

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "prompt-patterns")
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",") if origin.strip()]
ORIGIN_REGEX = os.getenv(
    "CORS_ALLOW_ORIGIN_REGEX",
    r"https?://((localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}))(:\d+)?$",
)

app = FastAPI(title="PromptTune API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

# -----------------------------
# Minimal in-memory session store (last N messages)
# -----------------------------
SESSION_MEMORY: Dict[str, Dict[str, List[Dict[str, str]]]] = {}
MAX_HISTORY = 20


def get_session_history(user_id: str, session_id: str) -> List[Dict[str, str]]:
    user_sessions = SESSION_MEMORY.setdefault(user_id, {})
    return user_sessions.setdefault(session_id, [])


DEFAULT_PERSONAS = [
    {
        "slug": "product-manager",
        "name": "Product Manager",
        "description": "Frames prompts around user value, measurable outcomes, and stakeholder-ready context.",
        "instructions": (
            "You are an executive-level Product Manager. Emphasize user value, clear acceptance criteria,"
            " metric instrumentation, and experiment-friendly outputs. Proactively call out risks,"
            " open questions, and cross-functional touchpoints."
        ),
        "tags": ["roadmap", "strategy", "experiments"],
    },
    {
        "slug": "data-scientist",
        "name": "Data Scientist",
        "description": "Optimizes for evidence, reproducibility, and rigorous evaluation steps.",
        "instructions": (
            "You are a principal Data Scientist. Demand structured inputs, cite assumptions, enforce"
            " statistical rigor, and highlight metrics, datasets, and validation procedures."
            " Encourage ablation-style follow-ups and red-team tests."
        ),
        "tags": ["analysis", "metrics", "ml"],
    },
    {
        "slug": "creative-writer",
        "name": "Creative Writer",
        "description": "Injects narrative voice, imagery, and pacing guidance for storytelling prompts.",
        "instructions": (
            "You are an award-winning Creative Director. Lean into vivid imagery, pacing cues,"
            " and emotional beats. Ensure prompts specify narrative structure, voice, and editing passes"
            " so drafts feel publish-ready."
        ),
        "tags": ["story", "brand", "voice"],
    },
    {
        "slug": "ux-researcher",
        "name": "UX Researcher",
        "description": "Prioritizes user empathy, usability metrics, and hypothesis-driven design for prompts.",
        "instructions": (
            "You are an experienced UX Researcher. Ask clarifying questions to reduce ambiguity, map user flows, "
            "and prefer outputs that are testable with prototypes or A/B tests. Recommend metrics for measuring success."
        ),
        "tags": ["ux", "research", "usability"],
    },
    {
        "slug": "customer-support",
        "name": "Customer Support Agent",
        "description": "Write responses that are empathetic, concise, and focused on resolving user issues quickly.",
        "instructions": (
            "You are a Customer Support Agent. Prioritize empathy, acknowledgement, and clear next steps. "
            "When needed, provide step-by-step troubleshooting and offer safe fallbacks or escalation paths."
        ),
        "tags": ["support", "faq", "triage"],
    },
    {
        "slug": "legal-counsel",
        "name": "Legal Counsel",
        "description": "Drafts prompts that are cautious, precise, and minimize legal exposure.",
        "instructions": (
            "You are a practical Legal Counsel. Flag legal risk, suggest contract-style clauses, and prefer "
            "language that reduces ambiguity and ensures compliance with general regulations. Do not provide "
            "jurisdiction-specific legal advice unless asked."
        ),
        "tags": ["legal", "compliance"],
    },
    {
        "slug": "marketing-copywriter",
        "name": "Marketing Copywriter",
        "description": "Focuses on conversion-oriented language, clarity, and brand voice cohesion.",
        "instructions": (
            "You are a senior Marketing Copywriter. Optimize for clarity, CTA strength, and voice consistency. "
            "Provide headline, subhead, and 2–3 variations for A/B testing. Call out tone and audience per prompt."
        ),
        "tags": ["marketing", "copy", "growth"],
    },
    {
        "slug": "security-analyst",
        "name": "Security Analyst",
        "description": "Examines prompts for threat modeling, data leakage, and security hardening.",
        "instructions": (
            "You are a Security Analyst. Evaluate prompts for sensitive data exposure, advise safer "
            "data handling, and recommend constraints to minimize attack surface for generated content."
        ),
        "tags": ["security", "privacy", "hardening"],
    },
]


def ensure_default_personas(db: Session) -> None:
    existing_slugs = {
        persona.slug: persona
        for persona in db.query(models.Persona).filter(models.Persona.is_default.is_(True)).all()
        if persona.slug
    }
    created = False
    for payload in DEFAULT_PERSONAS:
        if payload["slug"] in existing_slugs:
            continue
        persona = models.Persona(
            slug=payload["slug"],
            name=payload["name"],
            description=payload["description"],
            instructions=payload["instructions"],
            tags=payload.get("tags"),
            is_default=True,
        )
        db.add(persona)
        created = True
    if created:
        db.commit()


def _get_persona_for_user(persona_id: UUID, current_user: models.User, db: Session) -> models.Persona:
    persona = (
        db.query(models.Persona)
        .filter(
            models.Persona.id == persona_id,
            or_(models.Persona.user_id == current_user.id, models.Persona.user_id.is_(None)),
        )
        .first()
    )
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


def compose_system_prompt(persona_instructions: Optional[str], fallback: str) -> str:
    if persona_instructions:
        return f"{persona_instructions.strip()}\n\n{fallback}"
    return fallback


def resolve_persona(profile: models.Profile, current_user: models.User, db: Session, override_persona_id: Optional[UUID] = None) -> Optional[models.Persona]:
    target_id = override_persona_id or profile.active_persona_id
    if not target_id:
        return None
    try:
        return _get_persona_for_user(target_id, current_user, db)
    except HTTPException:
        if override_persona_id:
            raise
        profile.active_persona_id = None
        db.add(profile)
        db.commit()
        return None


def _get_owned_persona(persona_id: UUID, current_user: models.User, db: Session) -> models.Persona:
    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id, models.Persona.user_id == current_user.id)
        .first()
    )
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found or not owned by user")
    return persona


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

def build_meta_prompt(
    raw: str,
    goal: Optional[str],
    audience: Optional[str],
    style: Optional[str],
    patterns: List[Dict[str, Any]],
    persona_name: Optional[str] = None,
    persona_instructions: Optional[str] = None,
) -> str:
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

Persona Guidance:
- Persona: {persona_name or 'Generalist'}
- Instructions: {persona_instructions or 'n/a'}

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
    ensure_default_personas(db)
    profile = _ensure_profile(current_user, db)
    # Only touch relationship when id is set to avoid loading stale objects
    if profile.active_persona_id:
        _ = profile.active_persona
    return profile


@app.put("/me/preferences", response_model=schemas.ProfilePreferences)
def update_preferences(
    prefs: schemas.ProfilePreferences,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(current_user, db)
    update_data = prefs.model_dump(exclude_unset=True)
    # model_dump(exclude_unset=True) omits keys not sent by the client.
    # Use a presence check to distinguish "not provided" from explicit null.
    has_active_persona = "active_persona_id" in update_data
    persona_id = update_data.pop("active_persona_id", None)
    update_data.pop("active_persona", None)
    if has_active_persona:
        # Explicitly set or clear the active persona when the client provides the field
        if persona_id:
            persona = _get_persona_for_user(persona_id, current_user, db)
            profile.active_persona_id = persona.id
        else:
            profile.active_persona_id = None
            # Explicitly clear cached relationship when deactivating
            profile.active_persona = None
    for key, value in update_data.items():
        setattr(profile, key, value)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    # Only touch relationship if id is set, to avoid reloading after deactivation
    if profile.active_persona_id:
        _ = profile.active_persona
    return profile


@app.get("/personas", response_model=List[schemas.PersonaRead])
def list_personas(
    search: Optional[str] = None,
    include_defaults: bool = True,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_default_personas(db)
    query = db.query(models.Persona).filter(
        or_(models.Persona.user_id == current_user.id, models.Persona.is_default.is_(True))
    )
    if not include_defaults:
        query = query.filter(models.Persona.user_id == current_user.id)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter(func.lower(models.Persona.name).like(like))
    personas = query.order_by(models.Persona.is_default.desc(), models.Persona.created_at.desc()).all()
    return personas


@app.post("/personas", response_model=schemas.PersonaRead)
def create_persona(
    persona_in: schemas.PersonaCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    persona = models.Persona(
        user_id=current_user.id,
        name=persona_in.name,
        description=persona_in.description,
        instructions=persona_in.instructions,
        tags=persona_in.tags,
        is_default=False,
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return persona


@app.patch("/personas/{persona_id}", response_model=schemas.PersonaRead)
def update_persona(
    persona_id: UUID,
    persona_in: schemas.PersonaUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    persona = _get_owned_persona(persona_id, current_user, db)
    update_data = persona_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(persona, key, value)
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return persona


@app.delete("/personas/{persona_id}")
def delete_persona(
    persona_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    persona = _get_owned_persona(persona_id, current_user, db)
    db.delete(persona)
    db.query(models.Profile).filter(models.Profile.active_persona_id == persona.id).update(
        {"active_persona_id": None}, synchronize_session=False
    )
    db.commit()
    return {"status": "deleted"}


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
def list_prompts(
    q: Optional[str] = None,
    tags: Optional[List[str]] = Query(default=None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prompts = (
        db.query(models.Prompt)
        .filter(models.Prompt.user_id == current_user.id)
        .order_by(models.Prompt.created_at.desc())
    )
    if q:
        like = f"%{q.lower()}%"
        prompts = prompts.filter(
            or_(
                func.lower(models.Prompt.title).like(like),
                func.lower(models.Prompt.optimized_prompt).like(like),
            )
        )
    if tags:
        for tag in tags:
            prompts = prompts.filter(models.Prompt.tags.contains([tag]))
    prompts = prompts.all()
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


@app.post("/optimize", response_model=schemas.OptimizeResponse)
def optimize(
    req: schemas.OptimizeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _ensure_profile(current_user, db)
    persona = resolve_persona(profile, current_user, db, req.persona_id)
    effective_goal = req.goal or profile.default_goal
    effective_audience = req.audience or profile.default_audience
    effective_style = req.style or profile.default_style

    # Retrieve examples/patterns via RAG
    query_excerpt = req.raw_prompt if len(req.raw_prompt) < 200 else req.raw_prompt[:200]
    # Build meta-prompt
    meta_prompt = build_meta_prompt(
        raw=req.raw_prompt,
        goal=effective_goal,
        audience=effective_audience,
        style=effective_style,
        patterns=[],
        persona_name=persona.name if persona else None,
        persona_instructions=persona.instructions if persona else None,
    )

    # Call LLM via Groq
    base_system_prompt = "You are a meticulous prompt optimization assistant."
    system_message = compose_system_prompt(persona.instructions if persona else None, base_system_prompt)
    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": meta_prompt},
    ]
    result_text = call_groq_chat(messages)
    parsed = parse_structured_response(result_text)

    return schemas.OptimizeResponse(
        optimized_prompt=parsed["optimized_prompt"],
        rationale=parsed["rationale"],
        checklist=parsed["checklist"],
    )

@app.post("/chat", response_model=schemas.ChatResponse)
def chat(
    req: schemas.ChatRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_id = req.session_id
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    if not req.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    profile = _ensure_profile(current_user, db)
    persona = resolve_persona(profile, current_user, db, req.persona_id)
    history = get_session_history(str(current_user.id), session_id)

    payload: List[Dict[str, str]] = []
    base_chat_system = req.system_prompt or "You are a pragmatic prompt simulation assistant."
    payload.append({"role": "system", "content": compose_system_prompt(persona.instructions if persona else None, base_chat_system)})

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

    returned_msgs = req.messages + [schemas.ChatMessage(role="assistant", content=reply)]
    return schemas.ChatResponse(reply=reply, messages=returned_msgs)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
