"""
Quiz router: AI-powered quiz generation and submission
"""
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, QuizHistory
from app.schemas import (QuizGenerateRequest, QuizQuestion, QuizSubmitRequest,
                          QuizHistoryResponse)
from app.utils.auth import get_current_user
from app.services.ai_tutor import generate_quiz

router = APIRouter(prefix="/quiz", tags=["Quiz"])


@router.post("/generate")
async def generate_quiz_endpoint(
    request: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a quiz on a specific Data Science topic"""
    quiz_data = await generate_quiz(request.topic, request.difficulty, request.num_questions)

    # Save to database
    quiz_record = QuizHistory(
        user_id=current_user.id,
        topic=request.topic,
        difficulty=request.difficulty,
        num_questions=request.num_questions,
        questions_data=json.dumps(quiz_data.get("questions", [])),
        max_score=float(request.num_questions)
    )
    db.add(quiz_record)
    db.commit()
    db.refresh(quiz_record)

    return {
        "quiz_id": quiz_record.id,
        "topic": request.topic,
        "difficulty": request.difficulty,
        "num_questions": request.num_questions,
        "questions": quiz_data.get("questions", [])
    }


@router.post("/submit")
def submit_quiz(
    request: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit quiz answers and get score"""
    quiz = db.query(QuizHistory).filter(
        QuizHistory.id == request.quiz_history_id,
        QuizHistory.user_id == current_user.id
    ).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = json.loads(quiz.questions_data or "[]")
    if not questions:
        raise HTTPException(status_code=400, detail="No questions found for this quiz")

    # Grade answers
    score = 0
    feedback = []
    for i, q in enumerate(questions):
        key = str(i)
        user_answer = request.answers.get(key, "")
        correct = q.get("correct_answer", "")
        is_correct = user_answer.strip() == correct.strip()
        if is_correct:
            score += 1
        feedback.append({
            "question": q.get("question", ""),
            "user_answer": user_answer,
            "correct_answer": correct,
            "is_correct": is_correct,
            "explanation": q.get("explanation", "")
        })

    percentage = (score / max(len(questions), 1)) * 100

    # Update quiz record
    quiz.score = float(score)
    quiz.percentage = percentage
    quiz.time_taken_seconds = request.time_taken_seconds
    quiz.answers_data = json.dumps(feedback)

    # Trigger quiz notification
    from app.utils.notifications import create_notification
    create_notification(
        db,
        current_user.id,
        "quiz_submitted",
        "Quiz Submitted & Evaluated",
        f"You scored {score}/{len(questions)} ({round(percentage, 1)}%) on your '{quiz.topic}' quiz!",
        "quiz",
        quiz.id
    )

    db.commit()

    return {
        "quiz_id": quiz.id,
        "score": score,
        "max_score": len(questions),
        "percentage": round(percentage, 1),
        "grade": "A" if percentage >= 90 else "B" if percentage >= 80 else "C" if percentage >= 70 else "D" if percentage >= 60 else "F",
        "feedback": feedback
    }


@router.get("/history", response_model=List[QuizHistoryResponse])
def get_quiz_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get quiz history for current user"""
    quizzes = (
        db.query(QuizHistory)
        .filter(QuizHistory.user_id == current_user.id)
        .order_by(QuizHistory.created_at.desc())
        .limit(20)
        .all()
    )
    return quizzes


@router.get("/{quiz_id}")
def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific quiz with questions"""
    quiz = db.query(QuizHistory).filter(
        QuizHistory.id == quiz_id,
        QuizHistory.user_id == current_user.id
    ).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return {
        "id": quiz.id,
        "topic": quiz.topic,
        "difficulty": quiz.difficulty,
        "questions": json.loads(quiz.questions_data or "[]"),
        "score": quiz.score,
        "percentage": quiz.percentage,
        "created_at": quiz.created_at
    }
