"""
Assessment router: skill assessments and predictions
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Assessment, AssessmentSkill, Skill
from app.schemas import AssessmentCreate, AssessmentResponse
from app.utils.auth import get_current_user
from app.ml import get_performance_prediction, analyze_skill_gap

router = APIRouter(prefix="/assessment", tags=["Assessment"])


@router.post("", response_model=AssessmentResponse, status_code=201)
def create_assessment(
    data: AssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a skill assessment and get performance prediction"""
    # Calculate overall score
    scores = [
        data.programming_score or 50,
        data.ml_score or 50,
        data.statistics_score or 50,
        data.data_engineering_score or 50,
        data.cloud_score or 50,
        data.visualization_score or 50,
        data.soft_skills_score or 50,
    ]
    overall_score = sum(scores) / len(scores)

    # Get ML prediction
    performance = get_performance_prediction(
        cgpa=data.cgpa or current_user.cgpa or 7.0,
        avg_score=overall_score,
        completion_rate=0.3,
        num_skills=5,
        semester=data.semester or current_user.semester or 4,
        age=current_user.age or 22,
        num_courses_enrolled=5,
        avg_proficiency=2.0
    )

    # Skill gap analysis
    career = data.career_goal or current_user.career_goal or "Data Scientist"
    assessment_scores = {
        'programming_score': data.programming_score or 50,
        'ml_score': data.ml_score or 50,
        'statistics_score': data.statistics_score or 50,
        'data_engineering_score': data.data_engineering_score or 50,
        'cloud_score': data.cloud_score or 50,
        'visualization_score': data.visualization_score or 50,
        'soft_skills_score': data.soft_skills_score or 50,
    }
    gap_analysis = analyze_skill_gap(career, [], assessment_scores)

    # Determine recommended path
    if overall_score >= 75:
        path = "Advanced Track"
    elif overall_score >= 50:
        path = "Intermediate Track"
    else:
        path = "Beginner Track"

    # Update user info
    if data.career_goal:
        current_user.career_goal = data.career_goal
    if data.cgpa:
        current_user.cgpa = data.cgpa
    if data.semester:
        current_user.semester = data.semester
    db.commit()

    # Save assessment
    assessment = Assessment(
        user_id=current_user.id,
        cgpa=data.cgpa,
        semester=data.semester,
        experience_years=data.experience_years,
        career_goal=data.career_goal,
        programming_score=data.programming_score,
        ml_score=data.ml_score,
        statistics_score=data.statistics_score,
        data_engineering_score=data.data_engineering_score,
        cloud_score=data.cloud_score,
        visualization_score=data.visualization_score,
        soft_skills_score=data.soft_skills_score,
        overall_score=overall_score,
        performance_prediction=performance,
        recommended_path=path,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return AssessmentResponse(
        id=assessment.id,
        user_id=assessment.user_id,
        cgpa=assessment.cgpa,
        career_goal=assessment.career_goal,
        overall_score=assessment.overall_score,
        performance_prediction=performance,
        recommended_path=path,
        skill_gaps=gap_analysis['missing_skills'][:5],
        created_at=assessment.created_at
    )


@router.get("/results", response_model=List[AssessmentResponse])
def get_assessment_results(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all assessment results for current user"""
    assessments = (
        db.query(Assessment)
        .filter(Assessment.user_id == current_user.id)
        .order_by(Assessment.created_at.desc())
        .all()
    )
    results = []
    for a in assessments:
        results.append(AssessmentResponse(
            id=a.id,
            user_id=a.user_id,
            cgpa=a.cgpa,
            career_goal=a.career_goal,
            overall_score=a.overall_score,
            performance_prediction=a.performance_prediction,
            recommended_path=a.recommended_path,
            skill_gaps=[],
            created_at=a.created_at
        ))
    return results


@router.get("/skill-gap")
def get_skill_gap(
    career_goal: str = "Data Scientist",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get skill gap analysis for a career goal"""
    # Get latest assessment
    assessment = (
        db.query(Assessment)
        .filter(Assessment.user_id == current_user.id)
        .order_by(Assessment.created_at.desc())
        .first()
    )

    scores = {}
    if assessment:
        scores = {
            'programming_score': assessment.programming_score or 50,
            'ml_score': assessment.ml_score or 50,
            'statistics_score': assessment.statistics_score or 50,
            'data_engineering_score': assessment.data_engineering_score or 50,
            'cloud_score': assessment.cloud_score or 50,
            'visualization_score': assessment.visualization_score or 50,
            'soft_skills_score': assessment.soft_skills_score or 50,
        }

    gap = analyze_skill_gap(career_goal, [], scores)
    return gap
