"""
Coding Challenges router: AI-powered challenge generation and structured evaluation
"""
import json
from typing import List, Dict, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, CodingChallenge, CodingAttempt
from app.schemas import (CodingChallengeRequest, CodingChallengeResponse,
                          CodeSubmitRequest)
from app.utils.auth import get_current_user
from app.services.ai_tutor import generate_coding_challenge, evaluate_code_ai
from app.services.evaluator import run_evaluation_pipeline
from app.utils.notifications import create_notification

router = APIRouter(prefix="/coding-challenge", tags=["Coding Challenges"])


@router.post("/generate", response_model=CodingChallengeResponse, status_code=201)
async def generate_challenge(
    request: CodingChallengeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a coding challenge using AI"""
    challenge_data = await generate_coding_challenge(
        request.topic, request.difficulty, request.language
    )

    challenge = CodingChallenge(
        user_id=current_user.id,
        topic=request.topic,
        difficulty=request.difficulty,
        language=request.language,
        challenge_title=challenge_data.get("title", f"{request.difficulty} {request.topic} Challenge"),
        challenge_description=challenge_data.get("description", ""),
        starter_code=challenge_data.get("starter_code", ""),
        solution_code=challenge_data.get("reference_solution", ""),
        test_cases=json.dumps(challenge_data.get("public_test_cases", [])),
        hidden_test_cases=json.dumps(challenge_data.get("hidden_test_cases", [])),
        is_completed=False
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    
    return challenge


@router.post("/{challenge_id}/submit")
async def submit_code(
    challenge_id: int,
    request: CodeSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit code for a challenge and get structured AI evaluation with sandboxed test execution"""
    challenge = db.query(CodingChallenge).filter(
        CodingChallenge.id == challenge_id,
        CodingChallenge.user_id == current_user.id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Combine public and hidden test cases
    try:
        public_tcs = json.loads(challenge.test_cases or "[]")
    except:
        public_tcs = []
    try:
        hidden_tcs = json.loads(challenge.hidden_test_cases or "[]")
    except:
        hidden_tcs = []

    all_tcs = public_tcs + hidden_tcs
    all_tcs_json = json.dumps(all_tcs)

    # 1. Execute user code safely
    passed, total, tc_results = run_evaluation_pipeline(
        language=challenge.language,
        user_code=request.user_code,
        solution_code=challenge.solution_code,
        test_cases_json=all_tcs_json,
        function_name="solution"
    )

    correctness_score = (passed / max(total, 1)) * 100

    # Format test case summary for AI
    test_cases_summary = f"Passed {passed} out of {total} test cases.\nDetails:\n"
    for r in tc_results:
        status = "PASSED" if r["passed"] else "FAILED"
        test_cases_summary += f"- {r['description']}: {status}\n  Output: {r['output']}\n  Expected: {r['expected']}\n"

    # 2. AI code evaluation
    ai_evaluation = await evaluate_code_ai(
        language=challenge.language,
        user_code=request.user_code,
        reference_code=challenge.solution_code,
        challenge_description=challenge.challenge_description or "",
        test_cases_summary=test_cases_summary
    )

    # 3. Calculate final score matching weighting constraints
    logic_score = float(ai_evaluation.get("logic", 70))
    edge_case_score = float(ai_evaluation.get("edge_cases", 70))
    quality_score = float(ai_evaluation.get("code_quality", 70))
    relevance_score = float(ai_evaluation.get("reference_similarity", 70))

    final_score = (
        (correctness_score * 0.60) +
        (logic_score * 0.15) +
        (edge_case_score * 0.10) +
        (quality_score * 0.10) +
        (relevance_score * 0.05)
    )
    final_score = round(final_score, 1)

    # Update challenge fields
    challenge.user_code = request.user_code
    challenge.ai_feedback = json.dumps(ai_evaluation)
    challenge.score = final_score
    challenge.is_completed = True
    challenge.completed_at = datetime.now(timezone.utc)

    # 4. Save attempt in database
    attempt = CodingAttempt(
        user_id=current_user.id,
        challenge_id=challenge.id,
        submitted_code=request.user_code,
        language=challenge.language,
        score=final_score,
        test_cases_passed=passed,
        test_cases_total=total,
        ai_feedback=json.dumps(ai_evaluation)
    )
    db.add(attempt)

    # 5. Create notification
    create_notification(
        db,
        current_user.id,
        "challenge_evaluated",
        "Coding Challenge Evaluated",
        f"Your {challenge.language} solution for '{challenge.challenge_title}' received a score of {final_score}/100 ({round(final_score/10, 1)}/10).",
        "challenge",
        challenge.id
    )

    db.commit()

    return {
        "challenge_id": challenge_id,
        "feedback": ai_evaluation.get("feedback", ""),
        "improvements": ai_evaluation.get("improvements", []),
        "time_complexity": ai_evaluation.get("time_complexity", "N/A"),
        "space_complexity": ai_evaluation.get("space_complexity", "N/A"),
        "correctness_score": round(correctness_score, 1),
        "logic_score": logic_score,
        "code_quality_score": quality_score,
        "efficiency_score": float(ai_evaluation.get("code_quality", 70)),
        "score": final_score,
        "test_cases_passed": passed,
        "test_cases_total": total,
        "test_case_results": tc_results,
        "reference_solution": challenge.solution_code,
        "is_completed": True
    }


@router.get("", response_model=List[CodingChallengeResponse])
def list_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all coding challenges for current user, hiding solution details before completion"""
    challenges = (
        db.query(CodingChallenge)
        .filter(CodingChallenge.user_id == current_user.id)
        .order_by(CodingChallenge.created_at.desc())
        .all()
    )
    
    # Hide details for uncompleted challenges to prevent cheating
    for c in challenges:
        if not c.is_completed:
            c.solution_code = None
            
    return challenges


@router.get("/stats")
def get_challenge_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get coding challenge statistics"""
    challenges = db.query(CodingChallenge).filter(
        CodingChallenge.user_id == current_user.id
    ).all()

    total = len(challenges)
    completed = sum(1 for c in challenges if c.is_completed)
    avg_score = (sum(c.score or 0 for c in challenges if c.score and c.is_completed) /
                 max(completed, 1))
    topics = {}
    for c in challenges:
        topics[c.topic] = topics.get(c.topic, 0) + 1

    return {
        "total_attempted": total,
        "completed": completed,
        "completion_rate": round(completed / max(total, 1) * 100, 1),
        "avg_score": round(avg_score, 1),
        "top_topics": sorted(topics.items(), key=lambda x: x[1], reverse=True)[:5]
    }


@router.get("/{challenge_id}", response_model=CodingChallengeResponse)
def get_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific coding challenge, hiding solution details before completion"""
    challenge = db.query(CodingChallenge).filter(
        CodingChallenge.id == challenge_id,
        CodingChallenge.user_id == current_user.id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
        
    if not challenge.is_completed:
        challenge.solution_code = None
        
    return challenge
