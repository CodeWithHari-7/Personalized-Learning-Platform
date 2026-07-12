"""
Progress router: enrollment, progress tracking, time tracking, certificate upload & verification
"""
import os
import json
import base64
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import User, Course, Progress, Certificate, LearningPath, LearningPathStep
from app.schemas import (ProgressCreate, ProgressUpdate, ProgressResponse,
                          LearningPathResponse, LearningPathStep as LPStepSchema,
                          CourseResponse, CertificateResponse)
from app.utils.auth import get_current_user

router = APIRouter(tags=["Progress"])

CERT_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'certificates')
os.makedirs(CERT_UPLOAD_DIR, exist_ok=True)

ALLOWED_CERT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"}
MAX_CERT_SIZE_MB = 10


def check_and_notify_progress_milestones(db: Session, user_id: int, old_pct: float, new_pct: float, course_name: str, course_id: int):
    from app.utils.notifications import create_notification
    milestones = [25.0, 50.0, 75.0]
    for ms in milestones:
        if old_pct < ms <= new_pct:
            create_notification(
                db, 
                user_id, 
                "progress_milestone", 
                "Milestone Reached!", 
                f"You have reached {int(ms)}% progress in '{course_name}'!", 
                "course", 
                course_id
            )
    if old_pct < 100.0 <= new_pct:
        create_notification(
            db, 
            user_id, 
            "course_completed", 
            "Course Completed!", 
            f"Congratulations! You have completed '{course_name}'!", 
            "course", 
            course_id
        )


def _build_progress_response(p: Progress, course: Course) -> ProgressResponse:
    """Build a ProgressResponse with flattened course fields to prevent 'Untitled Course'"""
    # Determine status from percent if not set
    status = p.completion_status or "Not Started"
    if p.progress_percent and p.progress_percent > 0 and p.progress_percent < 100 and status == "Not Started":
        status = "In Progress"
    
    return ProgressResponse(
        id=p.id,
        user_id=p.user_id,
        course=CourseResponse.from_orm(course) if course else None,
        # Flat fields directly accessible by frontend — prevents "Untitled Course"
        course_name=course.course_name if course else "Unknown Course",
        provider=course.provider if course else None,
        category=course.category if course else None,
        level=course.level if course else None,
        course_url=course.url if course else None,
        # Progress
        progress_percent=p.progress_percent or 0.0,
        completion_status=status,
        score=p.score,
        certificate_earned=p.certificate_earned or False,
        time_spent_hours=p.time_spent_hours or 0.0,
        time_spent_seconds=p.time_spent_seconds or 0,
        completed_lessons=p.completed_lessons or 0,
        total_lessons=p.total_lessons or 10,
        enrollment_date=p.enrollment_date,
        last_accessed_at=p.last_accessed_at,
        completion_date=p.completion_date,
    )


# ─── Progress ──────────────────────────────────────────────────────────────────

@router.get("/progress/stats")
def get_progress_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregated progress statistics"""
    all_progress = db.query(Progress).filter(Progress.user_id == current_user.id).all()
    total = len(all_progress)
    completed = sum(1 for p in all_progress if p.completion_status == "Completed")
    in_progress = sum(1 for p in all_progress if p.completion_status == "In Progress")
    not_started = sum(1 for p in all_progress if p.completion_status == "Not Started")
    total_time_hrs = sum(p.time_spent_hours or 0.0 for p in all_progress)
    total_time_secs = sum(p.time_spent_seconds or 0 for p in all_progress)
    avg_score_values = [p.score for p in all_progress if p.score is not None]
    avg_score = sum(avg_score_values) / max(len(avg_score_values), 1)
    avg_progress = sum(p.progress_percent or 0 for p in all_progress) / max(total, 1)
    certs = db.query(Certificate).filter(Certificate.user_id == current_user.id).count()
    verified_certs = db.query(Certificate).filter(
        Certificate.user_id == current_user.id,
        Certificate.verification_status.in_(["Verified", "Likely Valid"])
    ).count()

    return {
        "total_enrolled": total,
        "completed": completed,
        "in_progress": in_progress,
        "not_started": not_started,
        "dropped": total - completed - in_progress - not_started,
        "completion_rate": round(completed / max(total, 1) * 100, 1),
        "avg_score": round(avg_score, 1),
        "avg_progress_percent": round(avg_progress, 1),
        "total_time_spent_hours": round(total_time_hrs, 2),
        "total_time_spent_seconds": total_time_secs,
        "certificates_uploaded": certs,
        "certificates_verified": verified_certs,
        "certificates_earned": sum(1 for p in all_progress if p.certificate_earned),
    }


@router.get("/progress", response_model=List[ProgressResponse])
def get_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[str] = None
):
    """Get all course progress for current user"""
    query = db.query(Progress).filter(Progress.user_id == current_user.id)
    if status:
        query = query.filter(Progress.completion_status == status)
    progress_list = query.order_by(Progress.enrollment_date.desc()).all()

    result = []
    for p in progress_list:
        course = db.query(Course).filter(Course.id == p.course_id).first()
        if course:
            result.append(_build_progress_response(p, course))
    return result


@router.post("/progress", response_model=ProgressResponse, status_code=201)
def enroll_course(
    data: ProgressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enroll in a course"""
    # Accept both string course_id (CRS0001) and numeric id
    course = db.query(Course).filter(Course.course_id == data.course_id).first()
    if not course:
        # Try numeric lookup as fallback
        try:
            numeric_id = int(data.course_id)
            course = db.query(Course).filter(Course.id == numeric_id).first()
        except (ValueError, TypeError):
            pass
    if not course:
        raise HTTPException(status_code=404, detail=f"Course '{data.course_id}' not found")

    existing = db.query(Progress).filter(
        Progress.user_id == current_user.id,
        Progress.course_id == course.id
    ).first()
    if existing:
        # Return existing instead of erroring — idempotent enrollment
        return _build_progress_response(existing, course)

    progress = Progress(
        user_id=current_user.id,
        course_id=course.id,
        progress_percent=data.progress_percent or 0.0,
        score=data.score,
        time_spent_hours=data.time_spent_hours or 0.0,
        time_spent_seconds=0,
        completed_lessons=0,
        total_lessons=10,
        notes=data.notes,
        completion_status="Not Started"
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    # Trigger enrollment notification
    from app.utils.notifications import create_notification
    create_notification(
        db, 
        current_user.id, 
        "course_enrolled", 
        "Course Enrolled", 
        f"Successfully enrolled in {course.course_name}!", 
        "course", 
        course.id
    )

    return _build_progress_response(progress, course)


@router.put("/progress/{progress_id}", response_model=ProgressResponse)
def update_progress(
    progress_id: int,
    data: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update course progress"""
    progress = db.query(Progress).filter(
        Progress.id == progress_id,
        Progress.user_id == current_user.id
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Progress record not found")

    old_pct = progress.progress_percent or 0.0

    update_data = data.dict(exclude_unset=True)
    for k, v in update_data.items():
        if hasattr(progress, k):
            setattr(progress, k, v)

    # Auto-complete logic
    if (data.progress_percent is not None and data.progress_percent >= 100) or \
       (data.completion_status == "Completed"):
        progress.completion_status = "Completed"
        progress.completion_date = datetime.now(timezone.utc)
        progress.progress_percent = 100.0
    elif data.progress_percent and data.progress_percent > 0:
        progress.completion_status = "In Progress"
        progress.last_accessed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(progress)
    course = db.query(Course).filter(Course.id == progress.course_id).first()

    # Trigger progress milestone notification
    check_and_notify_progress_milestones(
        db, 
        current_user.id, 
        old_pct, 
        progress.progress_percent or 0.0, 
        course.course_name if course else "Course", 
        progress.course_id
    )

    return _build_progress_response(progress, course)


@router.patch("/progress/{progress_id}/time")
def add_time_spent(
    progress_id: int,
    seconds: int = Query(..., ge=1, le=3600, description="Seconds to add"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add time spent to a course (called periodically by frontend while studying)"""
    progress = db.query(Progress).filter(
        Progress.id == progress_id,
        Progress.user_id == current_user.id
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Progress record not found")

    progress.time_spent_seconds = (progress.time_spent_seconds or 0) + seconds
    progress.time_spent_hours = round(progress.time_spent_seconds / 3600, 4)
    progress.last_accessed_at = datetime.now(timezone.utc)

    # Auto-set to "In Progress" if previously "Not Started"
    if progress.completion_status == "Not Started":
        progress.completion_status = "In Progress"

    db.commit()
    return {
        "progress_id": progress_id,
        "time_spent_seconds": progress.time_spent_seconds,
        "time_spent_hours": progress.time_spent_hours,
        "status": progress.completion_status,
    }


# ─── Certificate Upload & Verification ─────────────────────────────────────────

@router.post("/progress/{progress_id}/certificate")
async def upload_certificate(
    progress_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and AI-analyze a certificate for a course"""
    progress = db.query(Progress).filter(
        Progress.id == progress_id,
        Progress.user_id == current_user.id
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Progress record not found")

    course = db.query(Course).filter(Course.id == progress.course_id).first()

    # Validate file type
    if file.content_type not in ALLOWED_CERT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Accepted: PDF, PNG, JPG, WebP"
        )

    # Read and check size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_CERT_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_CERT_SIZE_MB}MB allowed.")

    # Save file to disk
    safe_name = f"{current_user.id}_{progress_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = os.path.join(CERT_UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # AI Analysis
    verification_status = "Needs Manual Review"
    verification_confidence = 0.5
    verification_reason = "Pending analysis"
    extracted_name = None
    extracted_course = None
    extracted_issuer = None
    extracted_date = None
    extracted_cert_id = None

    try:
        analysis = await _analyze_certificate_with_ai(
            file_bytes=file_bytes,
            content_type=file.content_type,
            expected_course_name=course.course_name if course else "",
            user_name=f"{current_user.first_name} {current_user.last_name}",
        )
        verification_status = analysis.get("status", "Needs Manual Review")
        verification_confidence = analysis.get("confidence", 0.5)
        verification_reason = analysis.get("reason", "")
        extracted_name = analysis.get("extracted_name")
        extracted_course = analysis.get("extracted_course")
        extracted_issuer = analysis.get("extracted_issuer")
        extracted_date = analysis.get("extracted_date")
        extracted_cert_id = analysis.get("extracted_cert_id")
    except Exception as e:
        print(f"[CERT] AI analysis error: {e}")
        verification_status = "Needs Manual Review"
        verification_reason = f"AI analysis encountered an error: {str(e)[:200]}"

    # Save certificate record
    cert = Certificate(
        user_id=current_user.id,
        progress_id=progress.id,
        course_id=progress.course_id,
        original_filename=file.filename,
        file_path=file_path,
        file_size_bytes=len(file_bytes),
        content_type=file.content_type,
        verification_status=verification_status,
        verification_confidence=verification_confidence,
        verification_reason=verification_reason,
        extracted_name=extracted_name,
        extracted_course=extracted_course,
        extracted_issuer=extracted_issuer,
        extracted_date=extracted_date,
        extracted_cert_id=extracted_cert_id,
        verified_at=datetime.now(timezone.utc) if verification_status in ("Verified", "Likely Valid") else None,
    )
    db.add(cert)

    from app.utils.notifications import create_notification
    # Send certificate uploaded notification
    create_notification(
        db, 
        current_user.id, 
        "certificate_uploaded", 
        "Certificate Uploaded", 
        f"Certificate for course '{course.course_name if course else 'Unknown'}' has been uploaded and submitted for AI evaluation.", 
        "certificate", 
        cert.id
    )

    # Only mark complete if Verified or Likely Valid
    if verification_status in ("Verified", "Likely Valid"):
        progress.completion_status = "Completed"
        progress.completion_date = datetime.now(timezone.utc)
        progress.certificate_earned = True
        progress.progress_percent = 100.0
        
        # Send verified/completion notification
        create_notification(
            db, 
            current_user.id, 
            "certificate_verified", 
            "Certificate Verified & Course Completed!", 
            f"Your certificate for '{course.course_name if course else 'Unknown'}' was verified ({verification_status}). Course marked as 100% completed!", 
            "course", 
            course.id if course else progress.course_id
        )
    elif verification_status == "Rejected":
        # Send rejected notification
        create_notification(
            db, 
            current_user.id, 
            "certificate_rejected", 
            "Certificate Verification Rejected", 
            f"Your certificate for '{course.course_name if course else 'Unknown'}' could not be verified: {verification_reason}", 
            "course", 
            course.id if course else progress.course_id
        )
    else:
        # Send pending review notification
        create_notification(
            db, 
            current_user.id, 
            "certificate_review", 
            "Certificate Needs Review", 
            f"Your certificate for '{course.course_name if course else 'Unknown'}' requires manual review: {verification_reason}", 
            "course", 
            course.id if course else progress.course_id
        )

    db.commit()
    db.refresh(cert)
    db.refresh(progress)

    return {
        "certificate_id": cert.id,
        "verification_status": cert.verification_status,
        "verification_confidence": cert.verification_confidence,
        "verification_reason": cert.verification_reason,
        "extracted_name": cert.extracted_name,
        "extracted_course": cert.extracted_course,
        "extracted_issuer": cert.extracted_issuer,
        "extracted_date": cert.extracted_date,
        "course_completed": verification_status in ("Verified", "Likely Valid"),
        "progress": _build_progress_response(progress, course),
    }


async def _analyze_certificate_with_ai(
    file_bytes: bytes,
    content_type: str,
    expected_course_name: str,
    user_name: str,
) -> dict:
    """Use Gemini to extract info and assess the certificate"""
    try:
        import google.generativeai as genai
        from app.config import get_settings
        settings = get_settings()

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")

        # For PDFs, just use text analysis. For images, use vision.
        if content_type == "application/pdf":
            prompt = f"""
You are a certificate verification expert.
A user named "{user_name}" uploaded a PDF document claiming it is a course completion certificate 
for the course: "{expected_course_name}".

Since this is a PDF, I cannot show you the image directly. 
Based on this context, provide a conservative assessment:
- Status: "Needs Manual Review"
- Confidence: 0.5
- Reason: PDF certificates require manual review for authenticity verification.

Respond ONLY with valid JSON matching this schema:
{{
  "status": "Needs Manual Review",
  "confidence": 0.5,
  "reason": "PDF certificates require manual review to verify authenticity.",
  "extracted_name": null,
  "extracted_course": null,
  "extracted_issuer": null,
  "extracted_date": null,
  "extracted_cert_id": null
}}
"""
            response = model.generate_content(prompt)
        else:
            # Image — use vision
            image_b64 = base64.b64encode(file_bytes).decode("utf-8")
            import google.generativeai as genai
            from google.generativeai.types import content_types

            prompt = f"""
You are a certificate verification expert. Analyze this certificate image carefully.

Expected course name: "{expected_course_name}"
Expected learner name: "{user_name}"

Extract and verify the following information from the image:
1. Learner/recipient name on certificate
2. Course name or title on certificate
3. Issuing organization
4. Completion date
5. Certificate ID (if visible)

Then assess authenticity based on:
- Name match: Does the name on certificate match "{user_name}"?
- Course match: Does the course name match "{expected_course_name}"?
- Document appearance: Does it look like a legitimate certificate?
- Consistency: Are fonts, logos, and layout consistent?

IMPORTANT: Do NOT claim a certificate is "Verified" based solely on visual analysis.
Only use "Verified" if there is strong evidence including certificate ID or verification URL.
Use "Likely Valid" for professional-looking certificates with name/course match.
Use "Needs Manual Review" if any details are unclear or partially match.
Use "Rejected" only if the document is clearly not a certificate or is obviously fabricated.

Respond ONLY with valid JSON (no markdown, no extra text):
{{
  "status": "Likely Valid",
  "confidence": 0.75,
  "reason": "Certificate appears professional with matching learner name and course title.",
  "extracted_name": "Name on certificate or null",
  "extracted_course": "Course title on certificate or null", 
  "extracted_issuer": "Issuing organization or null",
  "extracted_date": "Completion date or null",
  "extracted_cert_id": "Certificate ID or null"
}}
"""
            image_part = {"mime_type": content_type, "data": file_bytes}
            response = model.generate_content([prompt, image_part])

        raw = response.text.strip()
        # Strip markdown code blocks if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        result = json.loads(raw)

        # Enforce status values
        allowed = {"Verified", "Likely Valid", "Needs Manual Review", "Rejected"}
        if result.get("status") not in allowed:
            result["status"] = "Needs Manual Review"
        result["confidence"] = max(0.0, min(1.0, float(result.get("confidence", 0.5))))

        return result

    except Exception as e:
        print(f"[CERT AI] Error: {e}")
        return {
            "status": "Needs Manual Review",
            "confidence": 0.4,
            "reason": f"AI analysis could not complete: {str(e)[:150]}. Manual review required.",
            "extracted_name": None,
            "extracted_course": None,
            "extracted_issuer": None,
            "extracted_date": None,
            "extracted_cert_id": None,
        }


@router.get("/me/certificates")
def get_my_certificates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all certificates uploaded by current user"""
    certs = db.query(Certificate).filter(
        Certificate.user_id == current_user.id
    ).order_by(Certificate.uploaded_at.desc()).all()

    result = []
    for cert in certs:
        course = db.query(Course).filter(Course.id == cert.course_id).first()
        result.append({
            "id": cert.id,
            "progress_id": cert.progress_id,
            "course_id": cert.course_id,
            "course_name": course.course_name if course else "Unknown Course",
            "course_category": course.category if course else None,
            "original_filename": cert.original_filename,
            "verification_status": cert.verification_status,
            "verification_confidence": cert.verification_confidence,
            "verification_reason": cert.verification_reason,
            "extracted_name": cert.extracted_name,
            "extracted_course": cert.extracted_course,
            "extracted_issuer": cert.extracted_issuer,
            "extracted_date": cert.extracted_date,
            "extracted_cert_id": cert.extracted_cert_id,
            "uploaded_at": cert.uploaded_at.isoformat() if cert.uploaded_at else None,
            "verified_at": cert.verified_at.isoformat() if cert.verified_at else None,
        })
    return result


# ─── Learning Path ─────────────────────────────────────────────────────────────
@router.get("/learning-path", response_model=List[LearningPathResponse])
def get_learning_paths(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all learning paths for current user"""
    paths = db.query(LearningPath).filter(
        LearningPath.user_id == current_user.id,
        LearningPath.is_active == True
    ).all()

    result = []
    for path in paths:
        steps = db.query(LearningPathStep).filter(
            LearningPathStep.learning_path_id == path.id
        ).order_by(LearningPathStep.step_order).all()

        step_responses = []
        for step in steps:
            course = db.query(Course).filter(Course.id == step.course_id).first()
            if course:
                step_responses.append(LPStepSchema(
                    step_order=step.step_order,
                    course=CourseResponse.from_orm(course),
                    status=step.status,
                    is_mandatory=step.is_mandatory
                ))

        result.append(LearningPathResponse(
            id=path.id,
            career_goal=path.career_goal,
            path_name=path.path_name,
            description=path.description,
            total_courses=path.total_courses,
            estimated_weeks=path.estimated_weeks,
            completion_percent=path.completion_percent,
            is_active=path.is_active,
            steps=step_responses,
            created_at=path.created_at
        ))
    return result


@router.post("/learning-path", response_model=LearningPathResponse, status_code=201)
def create_learning_path(
    career_goal: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a personalized learning path for a career goal"""
    career_category_map = {
        'Data Scientist': ['Programming', 'SQL', 'Statistics', 'Machine Learning', 'Visualization'],
        'ML Engineer': ['Programming', 'Machine Learning', 'Deep Learning', 'DevOps', 'AI'],
        'Data Engineer': ['Programming', 'SQL', 'Data Engineering', 'Cloud', 'Databases'],
        'AI Engineer': ['Programming', 'Deep Learning', 'NLP', 'Computer Vision', 'AI'],
        'Data Analyst': ['SQL', 'Business Intelligence', 'Visualization', 'Statistics', 'Analytics'],
    }

    target_cats = career_category_map.get(career_goal, ['Machine Learning', 'Programming', 'SQL'])
    path_courses = []
    for cat in target_cats[:5]:
        courses = db.query(Course).filter(
            Course.category == cat,
            Course.level.in_(['Beginner', 'Intermediate'])
        ).order_by(Course.rating.desc()).limit(2).all()
        path_courses.extend(courses)

    if not path_courses:
        path_courses = db.query(Course).order_by(Course.rating.desc()).limit(10).all()

    path = LearningPath(
        user_id=current_user.id,
        career_goal=career_goal,
        path_name=f"{career_goal} Learning Path",
        description=f"Personalized {career_goal} pathway covering essential skills and technologies.",
        total_courses=len(path_courses),
        estimated_weeks=len(path_courses) * 2,
        completion_percent=0.0
    )
    db.add(path)
    db.commit()
    db.refresh(path)

    step_responses = []
    for i, course in enumerate(path_courses):
        step = LearningPathStep(
            learning_path_id=path.id,
            course_id=course.id,
            step_order=i + 1,
            status="Pending",
            is_mandatory=i < 5
        )
        db.add(step)
        step_responses.append(LPStepSchema(
            step_order=i + 1,
            course=CourseResponse.from_orm(course),
            status="Pending",
            is_mandatory=i < 5
        ))

    current_user.career_goal = career_goal
    db.commit()

    return LearningPathResponse(
        id=path.id,
        career_goal=path.career_goal,
        path_name=path.path_name,
        description=path.description,
        total_courses=path.total_courses,
        estimated_weeks=path.estimated_weeks,
        completion_percent=0.0,
        is_active=True,
        steps=step_responses,
        created_at=path.created_at
    )


# ─── Additional Endpoints Required by UI/Prompt ───────────────────────────────

@router.post("/courses/{course_id}/enroll", response_model=ProgressResponse)
def enroll_course_by_id_path(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enroll in a course by its ID path parameter"""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        try:
            numeric_id = int(course_id)
            course = db.query(Course).filter(Course.id == numeric_id).first()
        except (ValueError, TypeError):
            pass
    if not course:
        raise HTTPException(status_code=404, detail=f"Course '{course_id}' not found")

    existing = db.query(Progress).filter(
        Progress.user_id == current_user.id,
        Progress.course_id == course.id
    ).first()
    if existing:
        return _build_progress_response(existing, course)

    progress = Progress(
        user_id=current_user.id,
        course_id=course.id,
        progress_percent=0.0,
        completion_status="Not Started"
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    # Trigger enrollment notification
    from app.utils.notifications import create_notification
    create_notification(
        db, 
        current_user.id, 
        "course_enrolled", 
        "Course Enrolled", 
        f"Successfully enrolled in {course.course_name}!", 
        "course", 
        course.id
    )

    return _build_progress_response(progress, course)


@router.get("/courses/available", response_model=List[CourseResponse])
def get_available_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of available courses that the user is not yet enrolled in"""
    enrolled_ids = [r[0] for r in db.query(Progress.course_id).filter(Progress.user_id == current_user.id).all()]
    query = db.query(Course)
    if enrolled_ids:
        query = query.filter(~Course.id.in_(enrolled_ids))
    return query.limit(100).all()


@router.get("/me/enrolled-courses", response_model=List[ProgressResponse])
def get_enrolled_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's enrolled courses"""
    progress_list = db.query(Progress).filter(
        Progress.user_id == current_user.id
    ).order_by(Progress.enrollment_date.desc()).all()
    
    result = []
    for p in progress_list:
        course = db.query(Course).filter(Course.id == p.course_id).first()
        if course:
            result.append(_build_progress_response(p, course))
    return result


@router.get("/me/completed-courses", response_model=List[ProgressResponse])
def get_completed_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's completed courses"""
    progress_list = db.query(Progress).filter(
        Progress.user_id == current_user.id,
        Progress.completion_status == "Completed"
    ).order_by(Progress.completion_date.desc().nullsfirst()).all()
    
    result = []
    for p in progress_list:
        course = db.query(Course).filter(Course.id == p.course_id).first()
        if course:
            result.append(_build_progress_response(p, course))
    return result


@router.get("/me/progress", response_model=List[ProgressResponse])
def get_me_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias for /progress"""
    return get_progress(current_user=current_user, db=db)


@router.patch("/courses/{course_id}/progress", response_model=ProgressResponse)
def patch_course_progress(
    course_id: str,
    progress_percent: float = Query(..., ge=0.0, le=100.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update progress percentage for a course"""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        try:
            numeric_id = int(course_id)
            course = db.query(Course).filter(Course.id == numeric_id).first()
        except (ValueError, TypeError):
            pass
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    progress = db.query(Progress).filter(
        Progress.user_id == current_user.id,
        Progress.course_id == course.id
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    old_pct = progress.progress_percent or 0.0
    progress.progress_percent = progress_percent
    if progress_percent >= 100.0:
        progress.completion_status = "Completed"
        progress.completion_date = datetime.now(timezone.utc)
        progress.certificate_earned = True
    elif progress_percent > 0.0:
        progress.completion_status = "In Progress"
        progress.last_accessed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(progress)

    # Trigger progress milestone notification
    check_and_notify_progress_milestones(
        db, 
        current_user.id, 
        old_pct, 
        progress.progress_percent or 0.0, 
        course.course_name, 
        progress.course_id
    )

    return _build_progress_response(progress, course)


@router.post("/courses/{course_id}/time")
def post_course_time(
    course_id: str,
    seconds: int = Query(..., ge=1, le=3600),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log study time for a course"""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        try:
            numeric_id = int(course_id)
            course = db.query(Course).filter(Course.id == numeric_id).first()
        except (ValueError, TypeError):
            pass
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    progress = db.query(Progress).filter(
        Progress.user_id == current_user.id,
        Progress.course_id == course.id
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    progress.time_spent_seconds = (progress.time_spent_seconds or 0) + seconds
    progress.time_spent_hours = round(progress.time_spent_seconds / 3600, 4)
    progress.last_accessed_at = datetime.now(timezone.utc)

    if progress.completion_status == "Not Started":
        progress.completion_status = "In Progress"

    db.commit()
    return {
        "course_id": course.id,
        "time_spent_seconds": progress.time_spent_seconds,
        "time_spent_hours": progress.time_spent_hours,
        "status": progress.completion_status
    }


@router.post("/certificates/upload")
async def upload_certificate_standalone(
    course_id: str = Query(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a certificate for a course directly"""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        try:
            numeric_id = int(course_id)
            course = db.query(Course).filter(Course.id == numeric_id).first()
        except (ValueError, TypeError):
            pass
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    progress = db.query(Progress).filter(
        Progress.user_id == current_user.id,
        Progress.course_id == course.id
    ).first()
    if not progress:
        # Create enrollment if they upload a certificate but are not enrolled yet
        progress = Progress(
            user_id=current_user.id,
            course_id=course.id,
            progress_percent=0.0,
            completion_status="Not Started"
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)

    return await upload_certificate(progress_id=progress.id, file=file, current_user=current_user, db=db)


@router.post("/certificates/{certificate_id}/verify")
def verify_certificate_endpoint(
    certificate_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify certificate endpoint"""
    cert = db.query(Certificate).filter(
        Certificate.id == certificate_id,
        Certificate.user_id == current_user.id
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    return {
        "id": cert.id,
        "verification_status": cert.verification_status,
        "verification_confidence": cert.verification_confidence,
        "verification_reason": cert.verification_reason,
        "extracted_name": cert.extracted_name,
        "extracted_course": cert.extracted_course,
    }

