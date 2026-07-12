"""
Courses router: browse, search, and filter courses
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.database import get_db
from app.models import User, Course
from app.schemas import CourseResponse, CourseListResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.get("", response_model=CourseListResponse)
def list_courses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    category: Optional[str] = None,
    level: Optional[str] = None,
    provider: Optional[str] = None,
    search: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_price: Optional[float] = None,
    language: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all courses with filtering and pagination, excluding enrolled courses"""
    from app.models import Progress
    # Find all course IDs the current user is enrolled in
    enrolled_course_ids = db.query(Progress.course_id).filter(Progress.user_id == current_user.id).all()
    enrolled_ids = [r[0] for r in enrolled_course_ids]

    query = db.query(Course)
    if enrolled_ids:
        query = query.filter(~Course.id.in_(enrolled_ids))

    if category:
        query = query.filter(Course.category == category)
    if level:
        query = query.filter(Course.level == level)
    if provider:
        query = query.filter(Course.provider == provider)
    if language:
        query = query.filter(Course.language == language)
    if search:
        query = query.filter(
            or_(
                Course.course_name.ilike(f"%{search}%"),
                Course.description.ilike(f"%{search}%"),
                Course.sub_category.ilike(f"%{search}%"),
            )
        )
    if min_rating is not None:
        query = query.filter(Course.rating >= min_rating)
    if max_price is not None:
        query = query.filter(Course.price <= max_price)

    total = query.count()
    courses = query.offset((page - 1) * page_size).limit(page_size).all()

    return CourseListResponse(
        courses=courses,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Get all unique course categories"""
    from sqlalchemy import distinct, func
    categories = db.query(distinct(Course.category)).order_by(Course.category).all()
    return [c[0] for c in categories if c[0]]


@router.get("/providers")
def get_providers(db: Session = Depends(get_db)):
    """Get all unique providers"""
    from sqlalchemy import distinct
    providers = db.query(distinct(Course.provider)).order_by(Course.provider).all()
    return [p[0] for p in providers if p[0]]


@router.get("/{course_id_str}", response_model=CourseResponse)
def get_course(course_id_str: str, db: Session = Depends(get_db)):
    """Get a single course by course_id (e.g., CRS0001)"""
    course = db.query(Course).filter(Course.course_id == course_id_str).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course
