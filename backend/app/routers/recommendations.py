"""
ML-Powered Recommendations Router
Uses the trained Random Forest model to predict course categories based on
user assessment scores, then matches against real courses from the database.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import User, Course, Recommendation, Assessment, Progress
from app.schemas import CourseResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

# ─── Career → Required skill categories ─────────────────────────────────────
CAREER_SKILL_MAP = {
    "Data Scientist":     ["Statistics", "Machine Learning", "Programming", "Visualization", "SQL"],
    "ML Engineer":        ["Machine Learning", "Deep Learning", "Programming", "AI", "Statistics"],
    "Data Engineer":      ["Data Engineering", "SQL", "Cloud", "Databases", "Programming"],
    "AI Engineer":        ["AI", "Deep Learning", "NLP", "Computer Vision", "Programming"],
    "Data Analyst":       ["SQL", "Analytics", "Visualization", "Statistics", "Business Intelligence"],
    "BI Developer":       ["Business Intelligence", "SQL", "Visualization", "Databases", "Analytics"],
    "Business Analyst":   ["Analytics", "Business Intelligence", "SQL", "Soft Skills"],
    "Research Scientist": ["Mathematics", "Statistics", "Deep Learning", "Machine Learning"],
    "MLOps Engineer":     ["DevOps", "Machine Learning", "Cloud", "Data Engineering"],
    "Cloud Data Engineer":["Cloud", "Data Engineering", "SQL", "DevOps"],
}

# Map assessment field names → human-readable skill names + categories
SKILL_FIELD_MAP = {
    "programming_score":      {"label": "Python / Programming", "category": "Programming",       "icon": "💻"},
    "ml_score":               {"label": "Machine Learning",     "category": "Machine Learning",  "icon": "🤖"},
    "statistics_score":       {"label": "Statistics",           "category": "Statistics",        "icon": "📊"},
    "data_engineering_score": {"label": "Data Engineering",     "category": "Data Engineering",  "icon": "⚙️"},
    "cloud_score":            {"label": "Cloud Computing",      "category": "Cloud",             "icon": "☁️"},
    "visualization_score":    {"label": "Data Visualization",   "category": "Visualization",     "icon": "📈"},
    "soft_skills_score":      {"label": "Soft Skills",          "category": "Soft Skills",       "icon": "🗣️"},
}


def _get_skill_scores_from_assessment(assessment: Assessment) -> dict:
    """Extract skill scores dict from assessment object"""
    return {
        "programming_score":      assessment.programming_score or 50,
        "ml_score":               assessment.ml_score or 50,
        "statistics_score":       assessment.statistics_score or 50,
        "data_engineering_score": assessment.data_engineering_score or 50,
        "cloud_score":            assessment.cloud_score or 50,
        "visualization_score":    assessment.visualization_score or 50,
        "soft_skills_score":      assessment.soft_skills_score or 50,
    }


def _predict_category_probabilities(assessment: Assessment, user: User, db: Session):
    """
    Feed assessment features into the Random Forest model and get
    category probabilities. Returns sorted list of (category, probability).
    """
    try:
        import joblib
        import numpy as np
        import os

        model_path = os.path.join(
            os.path.dirname(__file__), '..', '..', 'ml_training', 'artifacts', 'model.pkl'
        )
        if not os.path.exists(model_path):
            return None

        bundle = joblib.load(model_path)
        rec_model = bundle.get('recommendation_model')
        preprocessor = bundle.get('preprocessor')
        rec_enc = preprocessor['encoders']['recommended_category']
        X_columns = preprocessor['X_columns']

        # Progress stats for this user
        progresses = db.query(Progress).filter(Progress.user_id == user.id).all()
        num_enrolled = len(progresses)
        num_completed = sum(1 for p in progresses if p.completion_status == "Completed")
        avg_score = assessment.overall_score or 50.0
        cgpa = assessment.cgpa or 7.0
        semester = assessment.semester or 4
        completion_rate = num_completed / max(num_enrolled, 1)

        # Normalise features to match training scale
        row = {
            'age_scaled':                    (22 - 18) / 10.0,
            'semester_scaled':               (semester - 1) / 7.0,
            'cgpa_scaled':                   (cgpa - 5.0) / 5.0,
            'num_courses_enrolled_scaled':   num_enrolled / 20.0,
            'num_completed_scaled':          num_completed / 20.0,
            'completion_rate_scaled':        completion_rate,
            'avg_score_scaled':              avg_score / 100.0,
            'avg_progress_scaled':           avg_score / 100.0,
            'num_certificates_scaled':       0.1,
            'num_skills_scaled':             7 / 8.0,
            'avg_assessment_score_scaled':   avg_score / 100.0,
            'avg_proficiency_scaled':        (avg_score / 100.0) * 4 / 4.0,
            'total_projects_scaled':         0.2,
            'total_certifications_scaled':   0.1,
            'total_time_spent_scaled':       min(num_enrolled * 10, 200) / 1000.0,
            'gender_enc':                    0,
            'country_enc':                   0,
            'department_enc':                0,
            'top_skill_category_enc':        0,
            'last_course_category_enc':      0,
            'last_course_level_enc':         1,
        }

        X = np.array([row.get(c, 0.0) for c in X_columns]).reshape(1, -1)
        proba = rec_model.predict_proba(X)[0]
        classes = list(rec_enc.classes_)
        return sorted(zip(classes, proba), key=lambda x: -x[1])

    except Exception as e:
        print(f"[ML] Prediction error: {e}")
        return None


def _generate_ml_recommendations(user: User, assessment: Assessment, db: Session) -> List[dict]:
    """
    Core ML recommendation pipeline:
    1. Get user skill scores from assessment
    2. Predict category probabilities with Random Forest
    3. Compute skill gap (score vs career requirement)
    4. Score each predicted category by gap severity
    5. Fetch best matching courses from DB
    6. Return ranked list with reasons
    """
    career_goal = assessment.career_goal or user.career_goal or "Data Scientist"
    required_cats = CAREER_SKILL_MAP.get(career_goal, ["Machine Learning", "Programming", "SQL"])
    skill_scores = _get_skill_scores_from_assessment(assessment)

    # Map category → score
    cat_to_score = {
        "Programming":      skill_scores["programming_score"],
        "Machine Learning": skill_scores["ml_score"],
        "Statistics":       skill_scores["statistics_score"],
        "Data Engineering": skill_scores["data_engineering_score"],
        "Cloud":            skill_scores["cloud_score"],
        "Visualization":    skill_scores["visualization_score"],
        "Soft Skills":      skill_scores["soft_skills_score"],
        "AI":               skill_scores["ml_score"],
        "Deep Learning":    skill_scores["ml_score"],
        "NLP":              skill_scores["ml_score"],
        "Computer Vision":  skill_scores["ml_score"],
        "Analytics":        skill_scores["visualization_score"],
        "SQL":              skill_scores["data_engineering_score"],
        "Databases":        skill_scores["data_engineering_score"],
        "Business Intelligence": skill_scores["visualization_score"],
        "DevOps":           skill_scores["data_engineering_score"],
        "Mathematics":      skill_scores["statistics_score"],
    }

    # Get ML model category probabilities
    ml_probs = _predict_category_probabilities(assessment, user, db)
    ml_prob_dict = {}
    if ml_probs:
        ml_prob_dict = {cat: prob for cat, prob in ml_probs}

    # Already enrolled courses to exclude
    enrolled_ids = {p.course_id for p in db.query(Progress).filter(Progress.user_id == user.id).all()}

    # Build scored category list weighted by:
    # - Whether it's required for career goal (priority boost)
    # - How low the user's score is (skill gap = higher urgency)
    # - ML model probability (adds confidence)
    candidate_categories = list(set(required_cats + list(ml_prob_dict.keys())[:8]))
    cat_scores = []
    for cat in candidate_categories:
        user_score = cat_to_score.get(cat, 50)
        gap = max(0, 70 - user_score)  # gap = distance from proficiency threshold
        is_required = 1 if cat in required_cats else 0
        ml_weight = ml_prob_dict.get(cat, 0.02) * 100
        # Composite: gap-driven priority + career alignment + ML confidence
        composite = (gap * 0.5) + (is_required * 20) + (ml_weight * 0.3)
        cat_scores.append((cat, composite, user_score, gap, is_required))

    cat_scores.sort(key=lambda x: -x[1])

    recommendations = []
    used_course_ids = set(enrolled_ids)
    rank = 0

    for cat, composite_score, user_skill_score, gap, is_required in cat_scores:
        if rank >= 5:
            break

        # Find best matching courses for this category
        courses_q = (
            db.query(Course)
            .filter(
                Course.category == cat,
                ~Course.id.in_(used_course_ids) if used_course_ids else True
            )
            .order_by(Course.rating.desc().nullsfirst())
        )

        # Level selection: if user score < 40, prefer Beginner
        if user_skill_score < 40:
            beginner_courses = courses_q.filter(Course.level == "Beginner").limit(3).all()
            courses = beginner_courses if beginner_courses else courses_q.limit(3).all()
        elif user_skill_score < 70:
            inter_courses = courses_q.filter(Course.level == "Intermediate").limit(3).all()
            courses = inter_courses if inter_courses else courses_q.limit(3).all()
        else:
            adv_courses = courses_q.filter(Course.level == "Advanced").limit(3).all()
            courses = adv_courses if adv_courses else courses_q.limit(3).all()

        if not courses:
            courses = courses_q.limit(2).all()

        if not courses:
            continue

        course = courses[0]

        # Compute match % — differentiated by rank and skill gap
        ml_conf = ml_prob_dict.get(cat, 0.05)
        
        # Base score from rank (highest priority = highest match)
        rank_base = 98 - (rank * 8)  # rank 1=98 base, rank 2=90, rank 3=82...
        
        # Penalty if user already has decent skill (less urgent)
        skill_penalty = max(0, (user_skill_score - 40) / 60.0) * 15
        
        # Bonus from ML model confidence
        ml_bonus = ml_conf * 20  # adds up to ~3% typically
        
        # Career alignment bonus
        career_bonus = 5 if is_required else -5
        
        raw_match = rank_base - skill_penalty + ml_bonus + career_bonus
        match_pct = min(98, max(60, round(raw_match)))

        # Build human-readable reason
        skill_label = SKILL_FIELD_MAP.get(
            next((k for k, v in SKILL_FIELD_MAP.items() if v["category"] == cat), ""),
            {}
        ).get("label", cat)

        if gap > 30 and is_required:
            reason = (
                f"Your {cat} skill is at {user_skill_score}% — well below the "
                f"recommended 70% for a {career_goal}. This course directly closes that gap."
            )
        elif gap > 0 and is_required:
            reason = (
                f"This skill is required for your {career_goal} path. "
                f"Your current {cat} score ({user_skill_score}%) needs improvement."
            )
        elif is_required:
            reason = f"Core skill for {career_goal}. Your {cat} score is {user_skill_score}% — maintaining and advancing it is important."
        else:
            reason = (
                f"Our ML model (Random Forest, confidence {round(ml_conf*100, 1)}%) "
                f"predicts {cat} as a high-value area for your profile and {career_goal} goal."
            )

        used_course_ids.add(course.id)
        rank += 1

        recommendations.append({
            "rank": rank,
            "course_id": course.id,
            "course_name": course.course_name,
            "provider": course.provider,
            "category": course.category,
            "level": course.level,
            "rating": course.rating,
            "price": course.price,
            "url": course.url,
            "duration_hours": course.duration_hours,
            "certificate_available": course.certificate_available,
            "match_score": match_pct,
            "ml_confidence": round(ml_conf * 100, 1),
            "user_skill_score": user_skill_score,
            "skill_gap": gap,
            "is_career_required": bool(is_required),
            "reason": reason,
            "category_rank_in_career": required_cats.index(cat) + 1 if cat in required_cats else 99,
        })

    return recommendations


# ─── API Endpoints ─────────────────────────────────────────────────────────────

@router.get("/ml-powered")
def get_ml_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Main ML-powered recommendation endpoint.
    Reads user's latest assessment, runs Random Forest prediction,
    matches courses from DB, returns ranked personalized recommendations.
    """
    # Get latest assessment
    assessment = (
        db.query(Assessment)
        .filter(Assessment.user_id == current_user.id)
        .order_by(Assessment.created_at.desc())
        .first()
    )

    if not assessment:
        # Return placeholder telling user to complete assessment
        return {
            "status": "no_assessment",
            "message": "Please complete the Skill Assessment first to get personalized ML recommendations.",
            "career_goal": current_user.career_goal or "Data Scientist",
            "skill_summary": [],
            "recommendations": [],
        }

    career_goal = assessment.career_goal or current_user.career_goal or "Data Scientist"
    skill_scores = _get_skill_scores_from_assessment(assessment)
    required_cats = CAREER_SKILL_MAP.get(career_goal, ["Machine Learning", "Programming", "SQL"])

    # Build skill summary
    skill_summary = []
    for field, meta in SKILL_FIELD_MAP.items():
        score = skill_scores.get(field, 50)
        cat = meta["category"]
        is_required = cat in required_cats
        level = "Strong" if score >= 70 else ("Developing" if score >= 40 else "Gap")
        skill_summary.append({
            "field": field,
            "label": meta["label"],
            "category": cat,
            "icon": meta["icon"],
            "score": score,
            "level": level,
            "is_career_required": is_required,
        })

    skill_summary.sort(key=lambda x: (not x["is_career_required"], x["score"]))

    # Get ML recommendations
    recommendations = _generate_ml_recommendations(current_user, assessment, db)

    # Career readiness
    required_scores = [skill_scores.get(
        next((k for k, v in SKILL_FIELD_MAP.items() if v["category"] == cat), ""), 50
    ) for cat in required_cats]
    career_readiness = round(sum(required_scores) / max(len(required_scores), 1))

    # Strong vs gap skills for career
    strong_skills = [s["label"] for s in skill_summary if s["is_career_required"] and s["score"] >= 70]
    gap_skills = [s["label"] for s in skill_summary if s["is_career_required"] and s["score"] < 70]

    return {
        "status": "ok",
        "career_goal": career_goal,
        "career_readiness": career_readiness,
        "performance_level": assessment.performance_prediction or "Medium",
        "overall_score": assessment.overall_score or 50,
        "strong_skills": strong_skills,
        "gap_skills": gap_skills,
        "skill_summary": skill_summary,
        "recommendations": recommendations,
        "ml_model_info": {
            "model": "Random Forest Classifier",
            "version": "1.0.0",
            "categories_predicted": len(SKILL_FIELD_MAP),
        }
    }


@router.post("/enroll/{course_id}")
def enroll_from_recommendation(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enroll in a course from recommendation page"""
    from app.models import Progress
    from datetime import datetime

    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db.query(Progress).filter(
        Progress.user_id == current_user.id,
        Progress.course_id == course.id
    ).first()
    if existing:
        return {
            "message": "Already enrolled",
            "progress_id": existing.id,
            "url": course.url
        }

    progress = Progress(
        user_id=current_user.id,
        course_id=course.id,
        progress_percent=0.0,
        completion_status="In Progress"
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    return {
        "message": "Enrolled successfully",
        "progress_id": progress.id,
        "url": course.url,
        "course_name": course.course_name,
    }


# ─── Legacy endpoints (keep working) ──────────────────────────────────────────

@router.get("", response_model=List[dict])
def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Legacy: get existing recommendations"""
    recs = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == current_user.id, Recommendation.is_dismissed == False)
        .order_by(Recommendation.recommendation_score.desc())
        .limit(10)
        .all()
    )
    result = []
    for rec in recs:
        course = db.query(Course).filter(Course.id == rec.course_id).first()
        if course:
            result.append({
                "id": rec.id,
                "course": CourseResponse.from_orm(course).dict(),
                "recommendation_score": rec.recommendation_score,
                "reason": rec.reason,
                "created_at": str(rec.created_at) if rec.created_at else None
            })
    return result


@router.post("/generate", status_code=201)
def generate_recommendations(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Legacy generate endpoint"""
    return []


@router.post("/{rec_id}/dismiss")
def dismiss_recommendation(
    rec_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(Recommendation).filter(
        Recommendation.id == rec_id,
        Recommendation.user_id == current_user.id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec.is_dismissed = True
    db.commit()
    return {"message": "Recommendation dismissed"}
