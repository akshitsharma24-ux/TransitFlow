"""Chat endpoint for the rule-based journey assistant."""

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app import chatbot

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    context: Optional[dict[str, Any]] = None


class ChatResponse(BaseModel):
    reply: str
    intent: str
    entities: dict[str, Any] = {}
    card: Optional[dict[str, Any]] = None
    actions: list[dict[str, Any]] = []
    suggestions: list[str] = []
    context: dict[str, Any] = {}


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """Answer one message. The client sends the previous `context` back to enable follow-ups."""
    return chatbot.respond(request.message, request.context)
