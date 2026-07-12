"""
Chat router: AI Tutor with conversation history
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, ChatHistory
from app.schemas import ChatRequest, ChatMessage, ChatResponse
from app.utils.auth import get_current_user
from app.services.ai_tutor import get_ai_response, SYSTEM_PROMPT

router = APIRouter(prefix="/chat", tags=["AI Tutor"])


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to the AI Tutor and get a response"""
    session_id = request.session_id or str(uuid.uuid4())

    # Load conversation history for this session (last 10 messages)
    history = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.session_id == session_id
        )
        .order_by(ChatHistory.created_at.asc())
        .limit(20)
        .all()
    )

    messages = []
    for h in history:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": request.message})

    # Save user message
    user_msg = ChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        role="user",
        content=request.message,
        message_type=request.message_type
    )
    db.add(user_msg)
    db.commit()

    # Get AI response
    try:
        ai_response = await get_ai_response(messages, system=SYSTEM_PROMPT)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {str(e)}")

    # Save AI response
    ai_msg = ChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        role="assistant",
        content=ai_response,
        message_type="text"
    )
    db.add(ai_msg)
    db.commit()

    return ChatResponse(
        message=ai_response,
        session_id=session_id,
        role="assistant"
    )


@router.get("/history", response_model=List[ChatMessage])
def get_chat_history(
    session_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history for the current user"""
    query = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id)
    if session_id:
        query = query.filter(ChatHistory.session_id == session_id)

    messages = query.order_by(ChatHistory.created_at.asc()).limit(limit).all()
    return messages


@router.get("/sessions")
def get_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of chat sessions for the current user"""
    from sqlalchemy import func, distinct
    sessions = (
        db.query(
            ChatHistory.session_id,
            func.count(ChatHistory.id).label("message_count"),
            func.max(ChatHistory.created_at).label("last_message_at"),
            func.min(ChatHistory.content).label("first_message")
        )
        .filter(ChatHistory.user_id == current_user.id)
        .group_by(ChatHistory.session_id)
        .order_by(func.max(ChatHistory.created_at).desc())
        .limit(20)
        .all()
    )

    return [
        {
            "session_id": s.session_id,
            "message_count": s.message_count,
            "last_message_at": str(s.last_message_at),
            "preview": (s.first_message or "")[:80] + "..."
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session"""
    db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id,
        ChatHistory.session_id == session_id
    ).delete()
    db.commit()
    return {"message": "Session deleted"}
