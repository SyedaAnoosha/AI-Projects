from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: UUID
    exp: int


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserRead(UserBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PersonaBase(BaseModel):
    name: str
    description: Optional[str] = None
    instructions: str
    tags: Optional[List[str]] = None


class PersonaCreate(PersonaBase):
    pass


class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    tags: Optional[List[str]] = None


class PersonaRead(PersonaBase):
    id: UUID
    slug: Optional[str] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfilePreferences(BaseModel):
    industry: Optional[str] = None
    tone_preference: Optional[str] = None
    default_goal: Optional[str] = None
    default_audience: Optional[str] = None
    default_style: Optional[str] = None
    compliance_notes: Optional[str] = None
    active_persona_id: Optional[UUID] = None
    active_persona: Optional[PersonaRead] = None

    model_config = ConfigDict(from_attributes=True)


class PromptBase(BaseModel):
    title: str
    optimized_prompt: str
    rationale: Optional[str] = None
    tags: Optional[List[str]] = None


class PromptCreate(PromptBase):
    pass


class PromptUpdate(BaseModel):
    title: Optional[str] = None
    rationale: Optional[str] = None
    tags: Optional[List[str]] = None


class PromptRead(PromptBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnalyticsCreate(BaseModel):
    prompt_id: Optional[UUID] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    metrics: Optional[dict] = None
    note: Optional[str] = None


class AnalyticsRead(AnalyticsCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class OptimizeRequest(BaseModel):
    raw_prompt: str = Field(..., min_length=1, description="The user's raw prompt to optimize")
    goal: Optional[str] = Field(None, description="Goal or task this prompt should achieve")
    audience: Optional[str] = Field(None, description="Target audience or tone guidance")
    style: Optional[str] = Field(None, description="Style preferences (e.g., concise, formal)")
    session_id: Optional[str] = Field(None, description="Session id to bind memory (chat/testing)")
    persona_id: Optional[UUID] = Field(None, description="Override persona id for this run")

class OptimizeResponse(BaseModel):
    optimized_prompt: str
    rationale: str
    checklist: List[str] = []


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    messages: List[ChatMessage]
    system_prompt: Optional[str] = None
    persona_id: Optional[UUID] = Field(None, description="Override persona id for this chat exchange")


class ChatResponse(BaseModel):
    reply: str
    messages: List[ChatMessage]
